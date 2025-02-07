// risk-management/circuit-breakers.js
import { RiskProtocols } from './risk-protocols.js';
import config from '../shared/config.js';

export class PerformanceMonitor {
  constructor(tradingEngine) {
    this.riskProtocols = new RiskProtocols(tradingEngine);
    this.dailyMetrics = {
      grossProfit: 0,
      grossLoss: 0,
      maxDrawdown: 0,
      volatility: 0
    };
  }

  async update(tradeResult) {
    // Update metrics
    tradeResult.profit > 0 
      ? this.dailyMetrics.grossProfit += tradeResult.profit
      : this.dailyMetrics.grossLoss += Math.abs(tradeResult.profit);

    // Check all circuit breakers
    await this.checkDailyLossLimit();
    await this.checkProfitFactor();
    await this.checkVolatilitySpike();
  }

  async checkDailyLossLimit() {
    const portfolioValue = await this.tradingEngine.getPortfolioValue();
    const currentReturn = (this.dailyMetrics.grossProfit - this.dailyMetrics.grossLoss) / portfolioValue;
    
    if (currentReturn < config.risk.dailyLossLimit) {
      await this.riskProtocols.triggerProtocol('DAILY_LOSS_LIMIT', {
        currentReturn,
        threshold: config.risk.dailyLossLimit,
        lossAmount: this.dailyMetrics.grossLoss
      });
    }
  }

  async checkProfitFactor() {
    const profitFactor = this.dailyMetrics.grossProfit / (this.dailyMetrics.grossLoss || 1);
    
    if (profitFactor < config.risk.profitFactorThreshold) {
      await this.riskProtocols.triggerProtocol('PROFIT_FACTOR_DECLINE', {
        currentFactor: profitFactor,
        threshold: config.risk.profitFactorThreshold,
        winRate: this.winRate
      });
    }
  }

  async checkVolatilitySpike() {
    const { volatility } = await this.tradingEngine.getMarketConditions();
    
    if (volatility > config.risk.volatilityThreshold) {
      await this.riskProtocols.triggerProtocol('VOLATILITY_SPIKE', {
        volatility,
        threshold: config.risk.volatilityThreshold
      });
    }
  }

  get winRate() {
    const totalTrades = this.dailyMetrics.grossProfit + this.dailyMetrics.grossLoss;
    return totalTrades > 0 
      ? this.dailyMetrics.grossProfit / totalTrades
      : 0;
  }
}