// feature-engine/realtime-features.js
import Redis from 'ioredis';
import technicalindicators from 'technicalindicators';

const redis = new Redis();
redis.subscribe('market-data:processed', (err) => {
  // Implement real-time feature calculation
  redis.on('message', async (channel, message) => {
    const data = JSON.parse(message);
    
    // Calculate ATR-5
    const atr = new technicalindicators.default.ATR({
      high: data.highs,
      low: data.lows,
      close: data.closes,
      period: 5
    });
    
    // Publish features to model queue
    await redis.xadd('model-input', '*', 'features', JSON.stringify({
      symbol: data.sym,
      atr5: atr.getResult(),
      vwapDev: calculateVWAPDeviation(data),
      // ... other features
    }));
  });
});

function calculateVWAPDeviation(data) {
  return (data.lastPrice - data.vwap) / (data.atr5 || 1);
}