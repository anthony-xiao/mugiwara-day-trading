// data-ingestion/orderbook-manager.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export class OrderBookManager {
    constructor(symbol) {
      this.symbol = symbol;
      this.bidKey = `orderbook:${symbol}:bid`;
      this.askKey = `orderbook:${symbol}:ask`;
      this.redis = new Redis(process.env.REDIS_URL);
    }
  
    async updateBook(snapshot) {
      // Bids: higher prices first (negative for descending)
      const bidEntries = snapshot.bids.flatMap(b => [-b.price, b.size]);
      
      // Asks: lower prices first (positive for ascending)
      const askEntries = snapshot.asks.flatMap(a => [a.price, a.size]);
  
      await this.redis
        .multi()
        .del(this.bidKey)
        .zadd(this.bidKey, ...bidEntries)
        .del(this.askKey)
        .zadd(this.askKey, ...askEntries)
        .exec();
    }
  
    async getBestBid() {
      const bids = await this.redis.zrange(this.bidKey, 0, 0, 'WITHSCORES');
      return bids.length ? { 
        price: -parseFloat(bids[0][1]), // Convert back to positive
        size: parseFloat(bids[0][0])
      } : null;
    }
  
    async getBestAsk() {
      const asks = await this.redis.zrange(this.askKey, 0, 0, 'WITHSCORES');
      return asks.length ? { 
        price: parseFloat(asks[0][1]), 
        size: parseFloat(asks[0][0])
      } : null;
    }

    async clear() {
        await redis.del(this.bidKey);
        await redis.del(this.askKey);
      }
  }