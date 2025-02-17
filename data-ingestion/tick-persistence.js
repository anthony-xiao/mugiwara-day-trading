// data-ingestion/tick-persistence.js
import Redis from 'ioredis';
import { format } from 'date-fns';

export class TickStore {
  constructor(redisClient) {
    this.redis = redisClient;
    this.batch = this.redis.pipeline();
    this.batchSize = 0;
    this.MAX_BATCH_SIZE = 100; // Adjust based on performance testing
  }

  async saveTick(symbol, tickData) {
    try {
      const dateKey = format(new Date(tickData.timestamp), 'yyyyMMdd');
      const key = `ticks:${symbol}:${dateKey}`;
      
      // Add to sorted set with timestamp as score
      this.batch.zadd(
        key,
        tickData.timestamp,
        JSON.stringify({
          ...tickData,
          symbol,
          processedAt: Date.now()
        })
      );
      
      // Set expiration (7 days)
      this.batch.expire(key, 604800);
      
      this.batchSize++;
      
      if(this.batchSize >= this.MAX_BATCH_SIZE) {
        await this.flush();
      }
    } catch (err) {
      console.error('Error saving tick:', err);
      throw err;
    }
  }

  async flush() {
    if(this.batchSize > 0) {
      try {
        await this.batch.exec();
        this.batch = this.redis.pipeline();
        this.batchSize = 0;
        console.log('Successfully flushed tick batch');
      } catch (err) {
        console.error('Error flushing tick batch:', err);
        throw err;
      }
    }
  }

  async getTicks(symbol, startTime, endTime) {
    const dateKey = format(new Date(startTime), 'yyyyMMdd');
    const key = `ticks:${symbol}:${dateKey}`;
    
    try {
      const data = await this.redis.zrangebyscore(
        key,
        startTime,
        endTime,
        'WITHSCORES'
      );
      
      return data.map(([json, score]) => ({
        ...JSON.parse(json),
        timestamp: Number(score)
      }));
    } catch (err) {
      console.error('Error retrieving ticks:', err);
      throw err;
    }
  }
}

// Process cleanup handling
const cleanupHandler = async (store) => {
  console.log('Flushing remaining ticks before exit...');
  await store.flush();
  process.exit(0);
};

export function initializeTickPersistence(redisClient) {
  const store = new TickStore(redisClient);
  
  process.on('SIGINT', () => cleanupHandler(store));
  process.on('SIGTERM', () => cleanupHandler(store));
  process.on('beforeExit', () => store.flush());

  return store;
}