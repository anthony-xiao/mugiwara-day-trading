// feature-engine/realtime-features.js
import { ATR, RSI, SMA } from 'technicalindicators';
import { RollingWindowManager } from '../data-ingestion/rolling-window-manager.js';
import { TickProcessor } from '../data-ingestion/tick-processor.js';
import { OrderBookManager } from '../data-ingestion/orderbook-manager.js';


export class FeatureEngine {
  constructor(symbol) {
    this.symbol = symbol;
    this.windowManager = new RollingWindowManager(symbol);
    this.atrPeriod = 5;
    this.rsiPeriod = 3;
    this.volumePeriod = 20;
    this.tickProcessor = new TickProcessor(symbol);
    this.tickWindowSize = 100; // Analyze last 100 ticks
    this.orderBookManager = new OrderBookManager(symbol);
  }

  async calculateFeatures() {
    const window = await this.windowManager.getWindow();
    if (window.length < this.atrPeriod) return null;

    return {
      atr5: this._calculateATR(window),
      orderBookImbalance: this._calculateOrderImbalance(),
      rsi3: this._calculateRSI(window),
      vwapDeviation: this._calculateVWAPDeviation(window),
      volumeSpike: this._detectVolumeSpike(window),
      orderFlowImbalance: this._calculateTickImbalance()
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
    const [bestBid, bestAsk] = await Promise.all([
      this.orderBookManager.getBestBid(),
      this.orderBookManager.getBestAsk()
    ]);

    if (!bestBid || !bestAsk) return 0;

    // Calculate depth-weighted imbalance
    const bidDepth = bestBid.size;
    const askDepth = bestAsk.size;
    return (bidDepth - askDepth) / (bidDepth + askDepth);
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
    const ticks = await this.tickProcessor.getRecentTicks(this.tickWindowSize);
    
    let buyVolume = 0;
    let sellVolume = 0;
    ticks.forEach(t => {
      if (this.tickProcessor._isBuyTick(t)) buyVolume += t.size;
      if (this.tickProcessor._isSellTick(t)) sellVolume += t.size;
    });
  
    const total = buyVolume + sellVolume;
    return total > 0 ? (buyVolume - sellVolume) / total : 0;
  }
  
  async _reprocessCleanTicks() {
    // Get full window and filter out corrections
    const allTicks = await this.tickProcessor.getOrderFlow(this.windowSize);
    return allTicks.filter(t => 
      !TickProcessor._isCorrection(t)
    ).slice(-this.orderFlowWindow);
  }
}


function standardDeviation(values) {
  const avg = values.reduce((a,b) => a + b, 0) / values.length;
  return Math.sqrt(values.map(v => Math.pow(v - avg, 2)).reduce((a,b) => a + b, 0) / values.length);
}