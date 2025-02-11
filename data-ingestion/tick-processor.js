// data-ingestion/tick-processor.js
import Redis from 'ioredis';
import { RollingWindowManager } from './rolling-window-manager.js';

const redis = new Redis(process.env.REDIS_URL);

export class TickProcessor {
  constructor(symbol) {
    this.symbol = symbol;
    this.windowManager = new RollingWindowManager(`${symbol}:ticks`);
    this.tickWindowSize = 1000; // Last 1000 ticks
  }

  async processTick(tick) {
    // Use rolling window manager for tick storage
    await this.windowManager.updateWindow(tick.timestamp, tick);
    
    // Trim using count-based window (different from time-based)
    const currentCount = await this.windowManager.getCount();
    if(currentCount > this.tickWindowSize) {
      await this.windowManager.trimWindow(currentCount - this.tickWindowSize);
    }
  }

  async getOrderFlowImbalance() {
    const ticks = await this.windowManager.getWindow();
    if(ticks.length === 0) return 0;
    
    const buyTicks = ticks.filter(t => this._isBuyTick(t)).length;
    const sellTicks = ticks.length - buyTicks;
    
    return (buyTicks - sellTicks) / ticks.length;
  }

  _isBuyTick(tick) {
    return tick.conditions?.includes('B') || tick.price > tick.vwap;
  }

  async getOrderFlowImbalance() {
    const ticks = await redis.zrange(`ticks:${this.symbol}`, -100, -1);
    const parsed = ticks.map(JSON.parse);
    
    const buyTicks = parsed.filter(t => t.size > 0).length;
    const sellTicks = parsed.length - buyTicks;
    
    return (buyTicks - sellTicks) / parsed.length;
  }
}  
// Add count-based trimming to RollingWindowManager
RollingWindowManager.prototype.trimWindow = async function(count) {
    await redis.zremrangebyrank(this.key, 0, count - 1);
  };
  
  RollingWindowManager.prototype.getCount = async function() {
    return redis.zcard(this.key);
  }; 