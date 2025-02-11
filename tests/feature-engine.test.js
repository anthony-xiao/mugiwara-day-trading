// tests/feature-engine.test.js
import { strict as assert } from 'node:assert';
import Redis from 'ioredis';
import { FeatureEngine } from '../feature-engine/realtime-features.js';
import { OrderBookManager } from '../data-ingestion/orderbook-manager.js';

const redis = new Redis();
const TEST_SYMBOL = 'TEST';

describe('Feature Engine', () => {
  let orderBookManager;

  before(async () => {
    orderBookManager = new OrderBookManager(TEST_SYMBOL, redis);
    
    // Setup Order Book
    await orderBookManager.updateOrderBook({
      bids: [[100, 500], [99.5, 300]],  // Total bid depth: 800
      asks: [[101, 400], [101.5, 600]]  // Total ask depth: 1000
    });

    // Setup Tick Data
    await redis.del(`ticks:${TEST_SYMBOL}`);
    const tick1 = JSON.stringify({ price: 100.5, size: 100, conditions: ['B'], vwap: 100.3 });
    const tick2 = JSON.stringify({ price: 100.4, size: 200, conditions: [], vwap: 100.5 });
    await redis.zadd(`ticks:${TEST_SYMBOL}`, Date.now(), tick1, Date.now()+1, tick2);
  });

  after(async () => {
    await redis.del(`orderbook:${TEST_SYMBOL}`);
    await redis.del(`ticks:${TEST_SYMBOL}`);
    await redis.quit();
  });

  it('should calculate order book imbalance', async () => {
    const engine = new FeatureEngine(TEST_SYMBOL, redis);
    const imbalance = await engine._calculateOrderImbalance();
    
    // Expected calculation: (800 - 1000) / (800 + 1000) = -200/1800 ≈ -0.1111
    console.log('\n[Order Book Imbalance]');
    console.log('Calculated Imbalance:', imbalance);
    console.log('Expected Imbalance:', -0.1111);
    
    assert.ok(
      Math.abs(imbalance - (-0.1111)) < 0.001,
      `Imbalance ${imbalance} not within range of expected -0.1111`
    );
  });

  it('should calculate tick imbalance', async () => {
    const engine = new FeatureEngine(TEST_SYMBOL, redis);
    const imbalance = await engine._calculateTickImbalance();
    
    // Diagnostic logging
    const rawTicks = await redis.zrange(`ticks:${TEST_SYMBOL}`, 0, -1, 'WITHSCORES');
    console.log('\n[Tick Data Debug]');
    console.log('Raw Redis Data:', rawTicks);
    console.log('Expected Structure:', [
      JSON.stringify({ price: 100.5, size: 100, conditions: ['B'], vwap: 100.3 }),
      'score1',
      JSON.stringify({ price: 100.4, size: 200, conditions: [], vwap: 100.5 }),
      'score2'
    ]);
  
    assert.ok(
      Math.abs(imbalance - 0) < 0.001,
      `Imbalance should be 0 but got ${imbalance}. Check tick parsing logic.`
    );
  });
});