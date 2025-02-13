// ml-core/live-predictor.js
import * as tf from '@tensorflow/tfjs-node';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);
const MODEL_PATH = 'file://./ml-core/models/hybrid-model';

export class LivePredictor {
  constructor() {
    this.model = null;
    this.classes = ['LONG', 'SHORT'];
  }

  async loadModel() {
    this.model = await tf.loadLayersModel(MODEL_PATH);
    this.warmup();
  }

  async warmup() {
    // Initial inference to load weights
    const dummyInput = tf.zeros([1, 60, 12]);
    this.model.predict(dummyInput);
  }

  async predict(symbol) {
    const features = await redis.xread(
      'BLOCK', '0-0', 'COUNT', 60, 'STREAMS', `model:input:${symbol}`, '0'
    );
    
    const tensor = this._preprocess(features);
    const [direction, volatility, position] = this.model.predict(tensor);
    
    return {
      direction: this.classes[tf.argMax(direction).dataSync()[0]],
      volatility: volatility.dataSync()[0],
      positionSize: position.dataSync()[0]
    };
  }

  _preprocess(features) {
    // Convert Redis data to tensor
    return tf.tensor3d(
      features.map(f => Object.values(f)),
      [1, 60, 12] // [batch, timesteps, features]
    );
  }
}