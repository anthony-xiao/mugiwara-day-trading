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

  async updateOrderBook(quote) {
    // Polygon's quote format uses bp/bq for best bid, ap/aq for best ask
    const bidPrice = quote.bp || 0;
    const bidSize = quote.bs || 0;
    const askPrice = quote.ap || 0;
    const askSize = quote.as || 0;
    const timestamp = quote.t || Date.now();

    // Store best bid/ask in Redis Hash
    await redis.hset(this.key, {
      bestBid: bidPrice,
      bestBidSize: bidSize,
      bestAsk: askPrice,
      bestAskSize: askSize,
      timestamp
    });
    
    // Set TTL to auto-expire stale data
    await redis.expire(this.orderBookKey, 60); // 60 seconds
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
    return parseFloat(await redis.hget(this.key, 'bestBid'));
  }

  async getBestAsk() {
    return parseFloat(await redis.hget(this.key, 'bestAsk'));
  }

  async getOrderBook() {
    return redis.hgetall(this.key);
  }

}