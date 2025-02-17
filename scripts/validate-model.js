import { HybridModel } from '../ml-core/tfjs-model.js';
import { FeatureNormalizer } from '../feature-engine/feature-normalization.js';

const testFeatures = {
  atr5: 0.15,
  orderBookImbalance: -0.2,
  rsi3: 47,
  vwapDeviation: -0.003,
  volumeSpike: false,
  orderFlowImbalance: -0.15
};

async function runValidation() {
  try {
    const model = new HybridModel();
    const window = Array(60).fill(testFeatures);
    
    console.log('Normalized features:', 
      FeatureNormalizer.normalize(testFeatures));
    
    const prediction = await model.predict(window);
    console.log('Model prediction:', prediction);
    
    console.log('\u2713 Validation successful');
  } catch (e) {
    console.error('Validation failed:', e);
  }
}

runValidation();