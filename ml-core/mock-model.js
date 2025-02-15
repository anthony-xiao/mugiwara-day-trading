import * as tf from '@tensorflow/tfjs-node';

export class MockModel {
  constructor() {
    // Simple dense layer model that mimics your architecture
    this.model = tf.sequential();
    this.model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [6] // Matches your feature count
    }));
    this.model.add(tf.layers.dense({
      units: 3, // Direction, Volatility, Size
      activation: 'linear'
    }));
  }

  async save(path) {
    await this.model.save(`file://${path}`);
  }

  predict(input) {
    const tensor = tf.tensor2d([input]);
    const [direction, volatility, size] = this.model.predict(tensor);
    return {
      direction: direction.dataSync()[0] > 0.5 ? 'LONG' : 'SHORT',
      volatility: volatility.dataSync()[0],
      size: Math.min(1, Math.max(0.1, size.dataSync()[0]))
    };
  }
}