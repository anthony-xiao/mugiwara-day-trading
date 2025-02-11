// tests/tick-imbalance.test.js
import { TickProcessor } from '../data-ingestion/tick-processor.js';
import { FeatureEngine } from '../feature-engine/realtime-features.js';
import { strict as assert } from 'assert';

async function testTickImbalance() {
  const symbol = 'TEST';
  const processor = new TickProcessor(symbol, 1000); // Explicit window size
  await processor.clear();

  // Generate 100 unique ticks
  const baseTime = Date.now();
  const testTicks = Array.from({length: 100}, (_, i) => ({
    timestamp: baseTime + i,
    price: 150 + (i % 2 ? 0.25 : 0.24),
    size: 100,
    conditions: [i < 75 ? 'B' : 'S']
  }));

  // Batch process ticks
  await Promise.all(testTicks.map(t => processor.processTick(t)));

  // Verify storage
  const storedCount = await processor.redis.zcard(processor.redisKey);
  assert.equal(storedCount, 100, `Expected 100 ticks, got ${storedCount}`);

  // Calculate imbalance
  const engine = new FeatureEngine(symbol);
  const imbalance = await engine._calculateTickImbalance();
  
  assert.equal(imbalance.toFixed(1), '0.5', `Imbalance should be 0.5, got ${imbalance}`);
  
  await processor.clear();
  console.log('All tests passed');
}


testTickImbalance().catch(console.error);