import { loadModel, predict } from '../ml-core/tfjs-model.js';
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('Model Integration', () => {
  before(async () => {
    await loadModel();
  });

  it('should process sample features', async () => {
    const sampleFeatures = {
      atr5: 0.25,
      orderBookImbalance: 0.3,
      rsi3: 55,
      vwapDeviation: 0.005,
      volumeSpike: true,
      orderFlowImbalance: 0.2
    };

    const prediction = predict(sampleFeatures);
    
    assert.ok(prediction.direction === 'LONG' || prediction.direction === 'SHORT');
    assert.ok(typeof prediction.volatility === 'number');
    assert.ok(prediction.size >= 0.1 && prediction.size <= 1);
  });
});