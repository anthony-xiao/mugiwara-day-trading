// risk-management/risk-protocols.js
import { logger } from '../shared/logger.js';
import config from '../shared/config.js';
import { TradingEngine } from '../execution/trading-engine.js';

export class RiskProtocols {
  constructor(tradingEngine) {
    this.tradingEngine = tradingEngine;
    this.protocolsTriggered = new Set();
    this.lastTriggered = new Map();
  }

  /**
   * Main risk protocol handler with circuit breaker pattern
   * @param {string} reason - Protocol trigger reason
   * @param {object} metadata - Contextual data for decision making
   */
  async triggerProtocol(reason, metadata) {
    try {
      if (this.protocolsTriggered.has(reason)) return;

      logger.warn(`Risk protocol triggered: ${reason}`, metadata);
      this.protocolsTriggered.add(reason);
      this.lastTriggered.set(reason, Date.now());

      // Protocol-specific actions
      switch(reason) {
        case 'DAILY_LOSS_LIMIT':
          await this.handleDailyLossLimit(metadata);
          break;
        case 'PROFIT_FACTOR_DECLINE':
          await this.handleProfitFactorDecline(metadata);
          break;
        case 'VOLATILITY_SPIKE':
          await this.handleVolatilitySpike(metadata);
          break;
        default:
          await this.handleGenericProtocol(reason, metadata);
      }

      // Global risk reduction
      await this.reduceMarketExposure();
      
    } catch (error) {
      logger.error(`Protocol execution failed: ${error.message}`, { error });
      await this.emergencyShutdown();
    }
  }

  async handleDailyLossLimit({ lossAmount }) {
    // 1. Cancel all pending orders
    await this.tradingEngine.cancelAllOrders();
    
    // 2. Close 50% of positions immediately
    const positions = await this.tradingEngine.getPositions();
    for (const position of positions.slice(0, Math.ceil(positions.length/2))) {
      await this.tradingEngine.closePosition(position.symbol, 50);
    }
    
    // 3. Suspend trading for 15 minutes
    this.tradingEngine.suspendTrading(15 * 60 * 1000);
  }

  async handleProfitFactorDecline({ currentFactor, threshold }) {
    // Reduce position sizes proportionally to the factor decline
    const sizeMultiplier = Math.min(1, currentFactor / threshold);
    this.tradingEngine.setPositionSizeMultiplier(sizeMultiplier);
    
    // Switch to conservative strategy
    await this.tradingEngine.switchStrategy('conservative');
  }

  async handleVolatilitySpike({ volatility }) {
    // Increase stop-loss tightness
    this.tradingEngine.adjustStops({
      hardStop: config.stops.hardStop * 0.8,
      trailingStop: config.stops.trailingStop * 0.6
    });
    
    // Limit to liquid symbols only
    await this.tradingEngine.limitToLiquidSymbols();
  }

  async reduceMarketExposure() {
    // Reduce overall exposure by 25%
    const currentExposure = await this.tradingEngine.getPortfolioExposure();
    const targetExposure = currentExposure * 0.75;
    await this.tradingEngine.adjustPortfolioExposure(targetExposure);
  }

  async emergencyShutdown() {
    logger.error('Initiating emergency shutdown sequence');
    await this.tradingEngine.closeAllPositions();
    this.tradingEngine.shutdown();
    process.exit(1);
  }
}