import { HybridModel } from '../ml-core/tfjs-model.js';
import { generateTestSequence } from './generate_test_data.js';
import { expect } from 'chai';

describe('Hybrid Model', () => {
  const model = new HybridModel();
  
  before(async () => {
    await model.load();
  });

  it('should make predictions', async () => {
    const testData = generateTestSequence();
    const prediction = await model.predict(testData);
    
    expect(prediction).to.have.keys(['direction', 'volatility', 'position']);
    expect(['LONG', 'SHORT']).to.include(prediction.direction);
    expect(prediction.volatility).to.be.a('number').above(0);
    expect(prediction.position).to.be.a('number').within(0, 1);
  });

  it('should handle batch inputs', async () => {
    const batchData = [generateTestSequence(), generateTestSequence()];
    const tensor = tf.tensor(batchData);
    const output = model.model.predict(tensor);
    
    expect(output.length).to.equal(3); // 3 outputs
    expect(output[0].shape).to.eql([2, 1]); // Direction predictions
  });
});