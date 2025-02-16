import * as tf from '@tensorflow/tfjs-node';

async function testModel() {
  try {
    const model = await tf.loadLayersModel('file://./ml-core/models/hybrid_model/model.json');
    console.log('Model loaded successfully');
    
    // Test prediction with random input
    const input = tf.randomNormal([1, 60, 6]);
    const output = model.predict(input);
    
    console.log('Model outputs:', output);
    console.log('Model summary:');
    model.summary();
  } catch (error) {
    console.error('Error loading model:', error);
  }
}

testModel();