// data-ingestion/tick-processor.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Polygon.io trade condition codes
const BUY_CONDITIONS = new Set([
  'B',  // Auto-executed bid
  'F',  // Intermarket sweep bid
  'T',  // Form T
  'I',  // Odd lot bid
  'G'   // Extended hours trade (buy)
]);

const SELL_CONDITIONS = new Set([
  'S',  // Auto-executed ask
  'H',  // Intermarket sweep ask
  'E',  // Extended hours trade (sell)
  'J',  // Odd lot ask
  'K'   // Rule 155 trade (sell)
]);

export class TickProcessor {
  
    constructor(symbol, windowSize = 1000) {
        this.symbol = symbol;
        this.windowSize = windowSize;
        this.redisKey = `ticks:${symbol}`;
      }
    
      async processTick(tick) {
        // Ensure unique timestamp for each tick
        const enrichedTick = {
          ...tick,
          timestamp: Date.now() + Math.random(), // Add random for uniqueness
          isBuy: this._isBuyTick(tick),
          isSell: this._isSellTick(tick)
        };
    
        await redis
          .multi()
          .zadd(this.redisKey, enrichedTick.timestamp, JSON.stringify(enrichedTick))
          .zremrangebyrank(this.redisKey, 0, -this.windowSize - 1)
          .exec();
      }
    
      async getRecentTicks(count = 100) {
        const ticks = await redis.zrevrange(
          this.redisKey,
          0,
          count - 1,
          'WITHSCORES'
        );
        
        return ticks.map(t => {
          try {
            const data = JSON.parse(t[0]);
            return {
              ...data,
              timestamp: parseFloat(t[1])
            };
          } catch (error) {
            console.error('Failed to parse:', t[0]);
            return null;
          }
        }).filter(t => t !== null);
      }
  
    async getOrderFlowImbalance(windowSize = 100) {
      const ticks = await this.getRecentTicks(windowSize);
      
      let buyVolume = 0;
      let sellVolume = 0;
      
      ticks.forEach(t => {
        if (this._isBuyTick(t)) buyVolume += t.size;
        if (this._isSellTick(t)) sellVolume += t.size;
      });
  
      const total = buyVolume + sellVolume;
      return total > 0 ? (buyVolume - sellVolume) / total : 0;
    }
  
    _isBuyTick(tick) {
      return tick.conditions?.some(c => BUY_CONDITIONS.has(c));
    }
  
    _isSellTick(tick) {
      return tick.conditions?.some(c => SELL_CONDITIONS.has(c));
    }
  
    async clear() {
      await redis.del(this.redisKey);
    }
  }