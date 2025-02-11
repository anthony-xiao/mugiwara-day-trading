// feature-engine/realtime-features.js
import { ATR, RSI, SMA } from 'technicalindicators';
import { RollingWindowManager } from '../data-ingestion/rolling-window-manager.js';

export class FeatureEngine {
  constructor(symbol, redisClient) {
    this.symbol = symbol;
    this.redis = redisClient;
    this.windowManager = new RollingWindowManager(symbol, redisClient);
    this.tickWindowSize = 100;
    this.orderBookDepth = 5;
    this.atrPeriod = 5;
    this.rsiPeriod = 3;
    this.volumePeriod = 20;
  }

  async calculateFeatures() {
    const window = await this.windowManager.getWindow();
    if (window.length < this.atrPeriod) return null;

    const currentBar = await this.windowManager.getCurrentBar();


    return {
      atr5: this._calculateATR(window),
      orderBookImbalance: await this._calculateOrderImbalance(),
      rsi3: this._calculateRSI(window),
      vwapDeviation: this._calculateVWAPDeviation(currentBar),
      volumeSpike: this._detectVolumeSpike(window),
      orderFlowImbalance: await this._calculateTickImbalance()
    };
  }

  _calculateATR(bars) {
    const atrInput = {
      high: bars.map(b => b.high),
      low: bars.map(b => b.low),
      close: bars.map(b => b.close),
      period: this.atrPeriod
    };
    return ATR.calculate(atrInput).pop();
  }

  async _calculateOrderImbalance() {
    const orderBook = await this.redis.get(`orderbook:${this.symbol}`);
    if (!orderBook) return 0;
    
    const { bids, asks } = JSON.parse(orderBook);
    const bidDepth = this._calculateDepth(bids.slice(0, this.orderBookDepth));
    const askDepth = this._calculateDepth(asks.slice(0, this.orderBookDepth));
    
    return (bidDepth - askDepth) / (bidDepth + askDepth || 1);
  }

  

  _calculateDepth(levels) {
    return levels.reduce((acc, [price, size]) => acc + size, 0);
  }

  _calculateRSI(bars) {
    const rsiInput = {
      values: bars.map(b => b.close),
      period: this.rsiPeriod
    };
    return RSI.calculate(rsiInput).pop();
  }

  _calculateVWAPDeviation(bars) {
    const current = bars[bars.length - 1];
    const vwapMA = SMA.calculate({
      values: bars.map(b => b.vwap),
      period: this.atrPeriod
    }).pop();
    return (current.close - vwapMA) / vwapMA;
  }

  _detectVolumeSpike(bars) {
    const volumes = bars.map(b => b.volume);
    const baseline = SMA.calculate({
      values: volumes,
      period: this.volumePeriod
    }).pop();
    const currentVol = volumes.pop();
    const zScore = (currentVol - baseline) / 
      (standardDeviation(volumes) || 1);
    return zScore > 3;
  }

  async _calculateTickImbalance() {
    try {
      const ticks = await this.redis.zrange(
        `ticks:${this.symbol}`,
        -this.tickWindowSize,
        -1,
        'WITHSCORES'
      );
  
      // Process tick/score pairs correctly
      const parsedTicks = [];
      for (let i = 0; i < ticks.length; i += 2) {
        const tickStr = ticks[i];
        const score = ticks[i + 1];
        
        try {
          const tick = JSON.parse(tickStr);
          parsedTicks.push(tick);
          console.log(`Processed tick: ${tickStr}`);
        } catch (e) {
          console.error('Invalid tick:', { tickStr, score, error: e.message });
        }
      }
  
      console.log('Valid ticks count:', parsedTicks.length);
      
      if (parsedTicks.length === 0) return 0;
  
      const buyTicks = parsedTicks.filter(t => this._isBuyTick(t)).length;
      const sellTicks = parsedTicks.length - buyTicks;
      const imbalance = (buyTicks - sellTicks) / parsedTicks.length;
      
      console.log('Buy/Sell Breakdown:', { buyTicks, sellTicks, imbalance });
      
      return imbalance;
    } catch (error) {
      console.error('Tick imbalance error:', error);
      return 0;
    }
  }
  
  _isBuyTick(tick) {
    // Explicit check for VWAP comparison
    const comparisonPrice = tick.vwap ?? tick.close;
    return tick.conditions?.includes('B') || tick.price > comparisonPrice;
  }

  _isBuyTick(tick) {
    // Handle Polygon.io specific conditions
    return tick.conditions?.includes('B') || 
    (tick.price > (tick.vwap || tick.close));
  }
}

function standardDeviation(values) {
  const avg = values.reduce((a,b) => a + b, 0) / values.length;
  return Math.sqrt(values.map(v => Math.pow(v - avg, 2)).reduce((a,b) => a + b, 0) / values.length);
}