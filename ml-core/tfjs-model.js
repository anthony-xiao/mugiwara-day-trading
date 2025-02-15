import * as tf from '@tensorflow/tfjs-node';

export class HybridModel {
  constructor() {
    this.model = null;
    this.inputShape = [60, 6]; // 60 timesteps, 6 features
  }

  async load() {
    this.model = await tf.loadLayersModel('file://./models/hybrid_model/model.json');
  }

  create() {
    const inputs = tf.input({shape: this.inputShape});
    
    // LSTM Layer
    const lstm = tf.layers.lstm({
      units: 64,
      returnSequences: true
    }).apply(inputs);
    const norm1 = tf.layers.layerNormalization().apply(lstm);
    
    // Transformer Attention
    const attention = tf.layers.multiHeadAttention({
      numHeads: 4,
      keyDim: 64
    }).apply([norm1, norm1]);
    const norm2 = tf.layers.layerNormalization().apply(
      tf.layers.add().apply([attention, norm1])
    );
    
    // Pooling
    const pooled = tf.mean(norm2, 1);
    
    // Output Heads
    const direction = tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'direction'
    }).apply(pooled);
    
    const volatility = tf.layers.dense({
      units: 1,
      activation: 'relu',
      name: 'volatility'
    }).apply(pooled);
    
    const position = tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'position'
    }).apply(pooled);
    
    this.model = tf.model({
      inputs: inputs,
      outputs: [direction, volatility, position]
    });
    
    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: {
        'direction': 'binaryCrossentropy',
        'volatility': 'meanSquaredError',
        'position': 'meanSquaredError'
      },
      metrics: ['accuracy']
    });
  }

  async predict(inputData) {
    if (!this.model) await this.load();
    const tensor = tf.tensor([inputData]);
    const outputs = this.model.predict(tensor);
    
    return {
      direction: outputs[0].dataSync()[0] > 0.5 ? 'LONG' : 'SHORT',
      volatility: outputs[1].dataSync()[0],
      position: outputs[2].dataSync()[0]
    };
  }
}