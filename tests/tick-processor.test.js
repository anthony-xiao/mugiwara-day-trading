import { strict as assert } from 'node:assert';
import { TickProcessor } from '../data-ingestion/tick-processor.js';
import { RollingWindowManager } from '../data-ingestion/rolling-window-manager.js';

describe('Tick Processor', () => {
  const symbol = 'TEST';
  let processor;

  beforeEach(async () => {
    processor = new TickProcessor(symbol);
    // Clear existing data
    await new RollingWindowManager(`${symbol}:ticks`).trimWindow(0);
  });

  it('should process ticks and maintain window', async () => {
    const testTick = {
      timestamp: Date.now(),
      price: 150.25,
      size: 100,
      conditions: ['B'],
      vwap: 150.20
    };
    
    await processor.processTick(testTick);
    const imbalance = await processor.getOrderFlowImbalance();
    
    assert.equal(imbalance, 1); // Single buy tick
  });

  it('should trim excess ticks', async () => {
    // Add 1100 test ticks
    for(let i = 0; i < 1100; i++) {
      await processor.processTick({
        timestamp: Date.now() + i,
        price: 150 + i/1000,
        size: 100
      });
    }
    
    const count = await new RollingWindowManager(`${symbol}:ticks`).getCount();
    assert.equal(count, 1000);
  });
});