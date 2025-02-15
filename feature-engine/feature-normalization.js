export class FeatureNormalizer {
    static normalize(features) {
      // Safe RSI transformation with sigmoid
      const rsiTransform = (rsi) => {
        const centered = (rsi - 50) / 10;  // Scale to ±5 sigma
        return 1 / (1 + Math.exp(-centered));
      };
  
      return {
        // ATR: Log1p normalization with clipping
        atr5: Math.log1p(Math.max(0.0001, features.atr5)) / 10,
  
        // Order Book Imbalance: Direct use with NaN guard
        orderBookImbalance: features.orderBookImbalance || 0,
  
        // RSI: Handle undefined/null and apply transform
        rsi3: rsiTransform(features.rsi3 || 50),  // Default to neutral 50
  
        // VWAP: Clip to 3 sigma and scale
        vwapDeviation: Math.max(-3, Math.min(3, 
          (features.vwapDeviation || 0) / 0.01  // Handle undefined
        )),
  
        // Volume Spike: Boolean to binary
        volumeSpike: features.volumeSpike ? 1 : 0,
  
        // Order Flow: Tanh transform with epsilon guard
        orderFlowImbalance: Math.tanh(
          (features.orderFlowImbalance || 0) * 2 + Number.EPSILON
        )
      };

    }
    static getFeatureOrder() {
        return [
          'atr5',
          'orderBookImbalance',
          'rsi3', 
          'vwapDeviation',
          'volumeSpike',
          'orderFlowImbalance'
        ];
      }
  
  }

  