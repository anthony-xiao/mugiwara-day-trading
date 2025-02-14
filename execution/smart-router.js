// execution/smart-router.js
import { executeOrder } from './alpaca-router.js';
import { OrderBookManager } from '../data-ingestion/orderbook-manager.js';
import { Redis } from 'ioredis';
import axios from 'axios';

const redis = new Redis(process.env.REDIS_URL);
const POLYGON_API = process.env.POLYGON_API_KEY;

export class SmartRouter {
  constructor() {
    this.redis = redis;
    this.marketStatus = { 
      market: 'stocks',
      status: 'unknown',
      nextHours: 'regular',
      changeAt: new Date()
    };
    this.lastCheck = 0;
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
    return executeOrder(orderParams); // Use existing alpaca-router.js
  }

  async _checkMarketStatus() {
    try {
      const { data } = await axios.get(
        'https://api.polygon.io/v1/marketstatus/now',
        { params: { apiKey: POLYGON_API } }
      );
      
      this.marketStatus = {
        market: data.market || 'stocks',
        status: this._normalizeStatus(data.market),
        nextHours: data.exchanges?.nyse || 'regular',
        changeAt: new Date(data.serverTime)
      };
      
    } catch (error) {
      console.error('Market status check failed:', error);
      this.marketStatus.status = 'unknown';
    }
  }

  _normalizeStatus(status) {
  const statusMap = {
    'open': 'open',
    'closed': 'closed',
    'extended-hours': 'open',  // Treat extended hours as open
    'pre-market': 'closed',
    'after-hours': 'closed'
  };
  return statusMap[status?.toLowerCase()] || 'unknown';
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
    const obm = new OrderBookManager(symbol, this.redis);
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

    // Validate order parameters
    if (!Number.isInteger(signal.size)) {
      throw new Error(`Invalid order size: ${signal.size}`);
    }

    return {
        symbol: signal.symbol,
        quantity: signal.size.toString(), // Convert to string for Alpaca v3
        direction: signal.direction,
        type: 'limit',
        limit_price: price.toFixed(2),
        time_in_force: 'ioc',
        order_class: 'bracket',
        stop_loss: {
          stop_price: signal.stopPrice.toFixed(2),
          limit_price: (signal.stopPrice * 0.995).toFixed(2)
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