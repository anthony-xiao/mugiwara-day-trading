// feature-engine/realtime-pipeline.js
import Redis from 'ioredis';
import { FeatureEngine } from './realtime-features.js';

const redis = new Redis(process.env.REDIS_URL);
const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL']; // Add your symbols

export class RealTimePipeline {
  constructor() {
    this.engines = new Map(
      SYMBOLS.map(symbol => [symbol, new FeatureEngine(symbol)])
    );
  }

  async start() {
    // Subscribe to Polygon stream
    redis.subscribe('polygon:stream', (err) => {
      if (err) throw err;
    });

    redis.on('message', async (channel, message) => {
      const { symbol, data } = JSON.parse(message);
      const engine = this.engines.get(symbol);
      
      // Update rolling window
      await engine.windowManager.updateWindow(
        Date.now(),
        data
      );
      
      // Calculate features
      const features = await engine.calculateFeatures();
      
      // Publish to model queue
      if(features) {
        await redis.xadd(
          `model:input:${symbol}`,
          '*',
          'features',
          JSON.stringify(features)
        );
      }
    });
  }
}