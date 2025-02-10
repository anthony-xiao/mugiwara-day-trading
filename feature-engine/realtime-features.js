// feature-engine/realtime-features.js
import { ATR, RSI, SMA } from 'technicalindicators';
import { RollingWindowManager } from '../data-ingestion/rolling-window-manager.js';
import { TickProcessor } from '../data-ingestion/tick-processor.js';


export class FeatureEngine {
  constructor(symbol) {
    this.symbol = symbol;
    this.windowManager = new RollingWindowManager(symbol);
    this.atrPeriod = 5;
    this.rsiPeriod = 3;
    this.volumePeriod = 20;
    this.tickProcessor = new TickProcessor(symbol);
    this.tickWindowSize = 100; // Analyze last 100 ticks
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

  _calculateOrderImbalance() {
    // Implementation requires real-time bid/ask depth
    // From websocket data in Redis
    const bidDepth = /* Get from order book snapshot */;
    const askDepth = /* Get from order book snapshot */;
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
    
    let buyCount = 0;
    let sellCount = 0;
    
    ticks.forEach(t => {
      if(TickProcessor.isBuyTick(t)) buyCount++;
      if(TickProcessor.isSellTick(t)) sellCount++;
    });

    const total = buyCount + sellCount;
    return total > 0 ? (buyCount - sellCount) / total : 0;
  }
}


function standardDeviation(values) {
  const avg = values.reduce((a,b) => a + b, 0) / values.length;
  return Math.sqrt(values.map(v => Math.pow(v - avg, 2)).reduce((a,b) => a + b, 0) / values.length);
}