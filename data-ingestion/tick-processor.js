// data-ingestion/tick-processor.js
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Polygon.io trade condition codes (partial list)
const BUY_CONDITIONS = new Set(['B', 'F', 'T', 'I']);
const SELL_CONDITIONS = new Set(['S', 'H', 'E', 'J']);

export class TickProcessor {
  constructor(symbol, windowSize = 500) {
    this.symbol = symbol;
    this.windowSize = windowSize;
    this.redisKey = `ticks:${symbol}`;
  }

  async processTick(tick) {
    await redis
      .multi()
      .zadd(this.redisKey, tick.timestamp, JSON.stringify(tick))
      .zremrangebyrank(this.redisKey, 0, -this.windowSize - 1)
      .exec();
  }

  async getRecentTicks(count = 100) {
    const ticks = await redis.zrange(this.redisKey, -count, -1, 'WITHSCORES');
    return ticks.map(t => {
      const [data, timestamp] = t;
      return { ...JSON.parse(data), timestamp: parseInt(timestamp) };
    });
  }

  static isBuyTick(tick) {
    return tick.conditions?.some(c => BUY_CONDITIONS.has(c));
  }

  static isSellTick(tick) {
    return tick.conditions?.some(c => SELL_CONDITIONS.has(c));
  }
}