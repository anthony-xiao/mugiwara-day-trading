// data-ingestion/rolling-window-manager.js
import Redis from 'ioredis';
import { technicalIndicators } from 'technicalindicators';

const redis = new Redis(process.env.REDIS_URL);
const WINDOW_SIZE = 60; // 60-minute window

export class RollingWindowManager {
  constructor(symbol) {
    this.symbol = symbol;
    this.key = `rollingWindow:${symbol}`;
  }

  async updateWindow(timestamp, { open, high, low, close, volume, vwap }) {
    const bar = {
      timestamp: Math.floor(timestamp / 60000) * 60000, // Align to minute
      open,
      high,
      low,
      close,
      volume,
      vwap
    };
    
    // Update Redis sorted set (score = timestamp)
    await redis.zadd(this.key, bar.timestamp, JSON.stringify(bar));
    
    // Trim old data
    const cutoff = Date.now() - (WINDOW_SIZE * 60000);
    await redis.zremrangebyscore(this.key, '-inf', cutoff);
  }

  async getWindow() {
    const data = await redis.zrange(this.key, 0, -1);
    return data.map(JSON.parse).sort((a, b) => a.timestamp - b.timestamp);
  }

  async getCurrentBar() {
    const window = await this.getWindow();
    return window[window.length - 1];
  }
}