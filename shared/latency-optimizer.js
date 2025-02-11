// shared/latency-optimizer.js
export class LatencyOptimizer {
    static optimizeTensorFlow() {
      // Enable WebAssembly backend
      import('@tensorflow/tfjs-backend-wasm').then(() => {
        tf.setBackend('wasm');
      });
    }
  
    static precomputeIndicators(windowManager) {
      // Cache technical indicator calculations
      windowManager.getWindow().then(bars => {
        this.cachedATR = this._calculateATR(bars);
        this.cachedRSI = this._calculateRSI(bars);
      });
    }
  
    static async getCachedATR() {
      return this.cachedATR || 
        this.windowManager.getWindow().then(this._calculateATR);
    }
  }