// data-ingestion/orderbook-manager.js
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const ORDERBOOK_TTL = 30; // Seconds to keep snapshot

export class OrderBookManager {
  constructor(symbol, redisClient) {
    console.log(symbol)
    console.log(redisClient)
    if (!symbol) throw new Error('Symbol is required');
    if (!redisClient) throw new Error('Redis client is required');
    
    this.symbol = symbol;
    this.redis = redisClient;
    this.key = `orderbook:${symbol}`;
    this.maxLevels = 5; // Track top 5 levels
    this.orderBook = {
      bids: [],
      asks: []
    };
    // Add error handlers
    this.redis.on('error', err => 
      console.error(`Redis error (${symbol}):`, err)
    );
    this.redis.on('connect', () => 
      console.log(`Redis connected for ${symbol}`)
    );
  }

  async updateOrderBook(update) {
      // Merge updates with existing order book
      this.orderBook.bids = this._mergeLevels([...this.orderBook.bids, ...update.bids], 'desc');
      this.orderBook.asks = this._mergeLevels([...this.orderBook.asks, ...update.asks], 'asc');
      
      // Trim to max levels and store
      this.orderBook.bids = this.orderBook.bids.slice(0, this.maxLevels);
      this.orderBook.asks = this.orderBook.asks.slice(0, this.maxLevels);

    await redis.set(
      this.key,
      JSON.stringify(this.orderBook),
      'EX',
      ORDERBOOK_TTL
    );
  }

  _mergeLevels(levels, sortDirection) {
    // Aggregate by price level
    const merged = levels.reduce((acc, [price, size]) => {
      acc[price] = (acc[price] || 0) + size;
      return acc;
    }, {});

    console.log(Object.entries(merged))
    // Convert to array and sort
    return Object.entries(merged)
      .map(([price, size]) => [parseFloat(price), size])
      .sort((a, b) => sortDirection === 'desc' ? b[0] - a[0] : a[0] - b[0]);
  }

  async getOrderBook() {
    return JSON.parse(await redis.get(this.key));
  }

  async _verifyConnection() {
    if (!this.redis || this.redis.status !== 'ready') {
      await this.redis.connect();
    }
    return this.redis.ping();
  }

  async getBestBid() {
    await this._verifyConnection();
    const value = await this.redis.hget(`orderbook:${this.symbol}`, 'bestBid');
    return parseFloat(value) || 0;
  }

  async getBestAsk() {
    await this._verifyConnection();
    const value = await this.redis.hget(`orderbook:${this.symbol}`, 'bestAsk');
    return parseFloat(value) || 0;
  }
  
  async getFullBook() {
    return this.redis.hgetall(this.orderBookKey);
  }

}