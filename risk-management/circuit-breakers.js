// risk-management/circuit-breakers.js
class PerformanceMonitor {
    constructor() {
      this.winCount = 0;
      this.lossCount = 0;
      this.grossProfit = 0;
      this.grossLoss = 0;
    }
  
    update(tradeResult) {
      if(tradeResult.profit > 0) {
        this.winCount++;
        this.grossProfit += tradeResult.profit;
      } else {
        this.lossCount++;
        this.grossLoss += Math.abs(tradeResult.profit);
      }
      
      this.checkCircuitBreakers();
    }
  
    get profitFactor() {
      return this.grossProfit / (this.grossLoss || 1);
    }
  
    checkCircuitBreakers() {
      if(this.profitFactor < 1.8) {
        triggerRiskProtocol('Profit Factor Below Threshold');
      }
    }
  }