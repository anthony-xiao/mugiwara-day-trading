// data-ingestion/rolling-window-manager.js
import Redis from 'ioredis';
// import { technicalIndicators } from 'technicalindicators';

const redis = new Redis(process.env.REDIS_URL);
const WINDOW_SIZE = 60; // 60-minute window

export class RollingWindowManager {
  constructor(symbol, redisClient) {
    this.symbol = symbol;
    this.redis = redisClient;
    this.key = `rollingWindow:${symbol}`;
  }

  async updateWindow(timestamp, data) {
    const entry = {
      timestamp: typeof timestamp === 'number' ? timestamp : Date.now(),
      data
    };
    
    await redis.zadd(
      this.key,
      entry.timestamp,
      JSON.stringify(entry)
    );
    
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