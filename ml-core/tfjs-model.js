import * as tf from '@tensorflow/tfjs-node';
import { FeatureNormalizer } from '../feature-engine/feature-normalization.js';

const FEATURE_ORDER = FeatureNormalizer.getFeatureOrder();

export class HybridModel {
  constructor() {
    this.model = null;
    this.inputShape = [60, FEATURE_ORDER.length]; // 60 timesteps, 6 features
  }

  async loadModel() {
    this.model = await tf.loadLayersModel('file://./ml-core/models/hybrid_model/model.json');
    console.log('Model loaded successfully');
  }

  async predict(featureWindow) {
    if (!this.model) await this.loadModel();
    if (!Array.isArray(featureWindow) || featureWindow.length !== 60) {
      throw new Error('Input must be array of 60 normalized feature sets');
    }

    // Normalize and structure features
    const tensorData = featureWindow.map(featureSet => {
      const normalized = FeatureNormalizer.normalize(featureSet);
      return FEATURE_ORDER.map(k => normalized[k]);
    });

    // Create tensor with shape [1, 60, 6]
    const tensor = tf.tensor3d([tensorData], [1, 60, 6]);
    
    try {
      const outputs = this.model.predict(tensor);
      return {
        direction: outputs[0].dataSync()[0] > 0.5 ? 'LONG' : 'SHORT',
        volatility: outputs[1].dataSync()[0],
        position: Math.min(1, Math.max(0.1, outputs[2].dataSync()[0]))
      };
    } finally {
      tf.dispose(tensor);
    }
  }
}