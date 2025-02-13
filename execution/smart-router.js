// execution/smart-router.js
import Alpaca from '@alpacahq/alpaca-trade-api';
import { OrderBookManager } from '../data-ingestion/orderbook-manager.js';
import { Redis } from 'ioredis';
import axios from 'axios';

const redis = new Redis(process.env.REDIS_URL);
const POLYGON_API = process.env.POLYGON_API_KEY;

export class SmartRouter {
  constructor() {
    this.alpaca = new Alpaca({
      keyId: process.env.ALPACA_KEY,
      secretKey: process.env.ALPACA_SECRET,
      paper: true
    });
    // Initialize with default values
    this.marketStatus = { 
        market: 'stocks',
        status: 'unknown',
        nextHours: 'regular',
        changeAt: new Date()
        };
    this.lastCheck = Date.now();
  }

  async executeSignal(signal) {
    await this._checkMarketStatus();
    const marketData = await this._getMarketData(signal.symbol);
    
    console.log(`📊 ${this.marketStatus.market} Market Status:`, {
      status: this.marketStatus.status,
      dataSource: marketData.source,
      timestamp: marketData.timestamp
    });

    const orderParams = this._buildOrder(signal, marketData);
    return this.alpaca.placeOrder(orderParams);
  }

  async _checkMarketStatus() {
    try {
      // Remove cache check to force refresh first time
      if(this.lastCheck !== 0 && Date.now() - this.lastCheck < 300000) return;
      
      const { data } = await axios.get(
        'https://api.polygon.io/v1/marketstatus/now',
        { params: { apiKey: POLYGON_API } }
      );
      
      // Add fallback structure
      this.marketStatus = {
        market: data.market || 'stocks',
        status: data.status || 'unknown',
        nextHours: data.nextHours || 'regular',
        changeAt: data.changeAt ? new Date(data.changeAt) : new Date()
      };
      
      this.lastCheck = Date.now();
    } catch (error) {
      console.error('⚠️ Failed to get market status:', error.message);
      // Maintain safe defaults
      this.marketStatus = { 
        ...this.marketStatus,
        status: 'unknown'
      };
    }
  }

  async _getMarketData(symbol) {
    // Handle initial null state
    if(!this.marketStatus || !this.marketStatus.status) {
      console.log('🔄 Initial market status unknown, using cached data');
      return this._getCachedData(symbol);
    }
    
    if(this.marketStatus.status.toLowerCase() === 'open') {
      return this._getRealtimeData(symbol);
    }
    return this._getHistoricalData(symbol);
  }

  async _getRealtimeData(symbol) {
    const obm = new OrderBookManager(symbol);
    return {
      source: 'realtime',
      timestamp: Date.now(),
      bestBid: await obm.getBestBid(),
      bestAsk: await obm.getBestAsk(),
      lastTrade: await redis.get(`trades:${symbol}:last`),
      vwap: await redis.get(`rollingWindow:${symbol}:vwap`)
    };
  }

  async _getHistoricalData(symbol) {
    try {
      const [quote, trade] = await Promise.all([
        axios.get(`https://api.polygon.io/v2/last/nbbo/${symbol}`, {
          params: { apiKey: POLYGON_API }
        }),
        axios.get(`https://api.polygon.io/v2/last/trade/${symbol}`, {
          params: { apiKey: POLYGON_API }
        })
      ]);

      return {
        source: 'historical',
        timestamp: trade.data.results.t,
        bestBid: quote.data.results.p,
        bestAsk: quote.data.results.p,
        lastTrade: trade.data.results.p,
        vwap: trade.data.results.p // Fallback to last trade if no VWAP
      };
    } catch (error) {
      console.error('⚠️ Failed to get historical data:', error.message);
      return this._getCachedData(symbol);
    }
  }

  async _getCachedData(symbol) {
    console.log('🔄 Using cached data as fallback');
    return {
      source: 'cached',
      timestamp: await redis.get(`market:${symbol}:lastUpdated`),
      bestBid: await redis.get(`market:${symbol}:lastBid`),
      bestAsk: await redis.get(`market:${symbol}:lastAsk`),
      lastTrade: await redis.get(`market:${symbol}:lastTrade`),
      vwap: await redis.get(`rollingWindow:${symbol}:vwap`)
    };
  }

  _buildOrder(signal, marketData) {
    const price = this._calculateLimitPrice(
      signal.direction,
      marketData
    );

    console.log(`🎯 Order Details:`, {
      symbol: signal.symbol,
      direction: signal.direction,
      priceSource: marketData.source,
      limitPrice: price,
      marketStatus: this.marketStatus.status
    });

    return {
      symbol: signal.symbol,
      qty: signal.size,
      side: signal.direction,
      type: 'limit',
      limit_price: price,
      time_in_force: 'ioc',
      order_class: 'bracket',
      stop_loss: {
        stop_price: signal.stopPrice,
        limit_price: signal.stopPrice * 0.995
      }
    };
  }

  _calculateLimitPrice(direction, { bestBid, bestAsk }) {
    // Price improvement logic using Polygon data
    return direction === 'buy' 
      ? bestAsk * 0.9995  // Pay just below ask
      : bestBid * 1.0005; // Sell just above bid
  }
}