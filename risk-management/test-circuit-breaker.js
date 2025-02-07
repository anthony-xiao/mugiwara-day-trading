// risk-management/test-circuit-breaker.js
import { PerformanceMonitor } from './circuit-breakers.js';
import { TradingEngine } from '../execution/trading-engine.js';
import { vi } from 'vitest';

// Mock trading engine
class MockTradingEngine extends TradingEngine {
  constructor() {
    super();
    this.actions = [];
  }
  
  async cancelAllOrders() {
    this.actions.push('cancelAllOrders');
  }
}

describe('Risk Protocols', () => {
  let tradingEngine;
  let monitor;

  beforeEach(() => {
    tradingEngine = new MockTradingEngine();
    monitor = new PerformanceMonitor(tradingEngine);
  });

  test('triggers daily loss limit protocol', async () => {
    // Simulate 4% loss
    tradingEngine.getPortfolioValue = async () => 100000;
    await monitor.update({ profit: -4000 });
    
    expect(tradingEngine.actions).toContain('cancelAllOrders');
    expect(tradingEngine.positionSizeMultiplier).toBeLessThan(1);
  });

  test('reduces position size on profit factor decline', async () => {
    // First two profitable trades
    await monitor.update({ profit: 2000 });
    await monitor.update({ profit: 2000 });
    
    // Series of losses
    await monitor.update({ profit: -1500 });
    await monitor.update({ profit: -1500 });
    
    expect(tradingEngine.positionSizeMultiplier).toBeLessThan(1);
  });
});