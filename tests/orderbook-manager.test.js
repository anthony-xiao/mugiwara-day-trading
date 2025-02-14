// tests/orderbook-manager.test.js
import { OrderBookManager } from '../data-ingestion/orderbook-manager.js';
import { Redis } from 'ioredis';

const redis = new Redis();
const symbol = 'AAPL';

describe('OrderBookManager', () => {
  afterEach(async () => {
    await redis.del(`orderbook:${symbol}`);
  });

  it('should store and retrieve best bid/ask', async () => {
    const obm = new OrderBookManager(symbol, redis);
    
    await obm.updateOrderBook({
      bids: [[150.25, 500]],
      asks: [[150.30, 600]],
      timestamp: Date.now()
    });

    const bestBid = await obm.getBestBid();
    const bestAsk = await obm.getBestAsk();
    
    expect(bestBid).toBeCloseTo(150.25);
    expect(bestAsk).toBeCloseTo(150.30);
  });
});