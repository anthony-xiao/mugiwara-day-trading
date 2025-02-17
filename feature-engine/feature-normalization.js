export class FeatureNormalizer {
  static normalize(features) {
    return {
      atr5: this._normalizeATR(features.atr5),
      orderBookImbalance: this._normalizeImbalance(features.orderBookImbalance),
      rsi3: this._normalizeRSI(features.rsi3),
      vwapDeviation: this._normalizeVWAP(features.vwapDeviation),
      volumeSpike: features.volumeSpike ? 1 : 0,
      orderFlowImbalance: this._normalizeFlow(features.orderFlowImbalance)
    };
  }

  static _normalizeATR(value) {
    return Math.log(Math.max(0.0001, value) + 1) / 10;
  }

  static _normalizeImbalance(value) {
    return Math.max(-1, Math.min(1, value));
  }

  static _normalizeRSI(value) {
    return 1 / (1 + Math.exp(-(value - 50) / 10));
  }

  static _normalizeVWAP(value) {
    return Math.max(-3, Math.min(3, value / 0.01));
  }

  static _normalizeFlow(value) {
    return Math.tanh(value * 2);
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