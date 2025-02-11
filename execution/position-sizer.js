// execution/position-sizer.js
export class PositionSizer {
    constructor(portfolioValue = 100000, riskPerTrade = 0.01) {
      this.portfolioValue = portfolioValue;
      this.riskPerTrade = riskPerTrade;
    }
  
    calculateSize(currentPrice, atr, regime) {
      // Adjust risk based on market regime
      const regimeMultipliers = {
        'high-volatility': 0.5,
        'low-volatility': 1.2,
        'normal': 1.0
      };
      
      const adjustedRisk = this.riskPerTrade * 
        (regimeMultipliers[regime] || 1.0);
      
      // ATR-based position sizing
      const dollarRisk = this.portfolioValue * adjustedRisk;
      const positionSize = dollarRisk / (atr * 1.5);
      
      return Math.floor(positionSize);
    }
  }