import { HybridModel } from '../ml-core/tfjs-model.js';
import { expect } from 'chai';

describe('Model Integration', () => {
  const sampleFeatures = {  
    atr5: 0.25,
    orderBookImbalance: 0.3,
    rsi3: 55,
    vwapDeviation: 0.005,
    volumeSpike: true,
    orderFlowImbalance: 0.2
  };

  const createTestWindow = () => Array(60).fill({...sampleFeatures});

  it('should process valid feature window', async () => {
    const model = new HybridModel();
    const prediction = await model.predict(createTestWindow());
    
    expect(prediction).to.contain.keys('direction', 'volatility', 'position');
    expect(['LONG', 'SHORT']).to.include(prediction.direction);
    expect(prediction.volatility).to.be.within(0, 1);
    expect(prediction.position).to.be.within(0.1, 1);
  });

  it('should reject invalid window length', async () => {
    const model = new HybridModel();
    try {
      await model.predict([sampleFeatures]);
    } catch (e) {
      expect(e.message).to.include('60 normalized feature sets');
    }
  });

  it('should handle extreme values', async () => {
    const model = new HybridModel();
    const extremeFeatures = {
      atr5: 1000,
      orderBookImbalance: -2,
      rsi3: 100,
      vwapDeviation: 10,
      volumeSpike: true,
      orderFlowImbalance: 5
    };
    
    const window = Array(60).fill(extremeFeatures);
    const prediction = await model.predict(window);
    
    expect(prediction.position).to.be.within(0.1, 1);
  });
});