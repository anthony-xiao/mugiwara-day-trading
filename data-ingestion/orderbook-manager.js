// data-ingestion/orderbook-manager.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const ORDERBOOK_TTL = 30; // Seconds to keep snapshot

export class OrderBookManager {
  constructor(symbol, redisClient) {
    this.symbol = symbol;
    this.redis = redisClient;
    this.key = `orderbook:${symbol}`;
  }

  async updateOrderBook(snapshot) {
    await redis.set(
      this.key,
      JSON.stringify({
        bids: snapshot.bids,
        asks: snapshot.asks,
        timestamp: Date.now()
      }),
      'EX',
      ORDERBOOK_TTL
    );
  }

  async getOrderBook() {
    return JSON.parse(await redis.get(this.key));
  }
}