// execution/trading-engine.js
import Alpaca from '@alpacahq/alpaca-trade-api';
import config from '../shared/config.js';
import { logger } from '../shared/logger.js';
//import { TechnicalAnalysis } from '../feature-engine/technical-analysis.js';

export class TradingEngine {
  constructor() {
    this.alpaca = new Alpaca({
      keyId: config.ALPACA_KEY,
      secretKey: config.ALPACA_SECRET,
      paper: true,
      rateLimit: true
    });
    
    this.activeOrders = new Map();
    this.positions = new Map();
    this.positionSizeMultiplier = 1.0;
    this.tradingSuspended = false;
    this.orderCounter = 0;
    this.lastOrderTimestamp = 0;
  }

  /**
   * Core order execution method with smart order routing
   */
  async placeOrder(signal) {
    if(this.tradingSuspended) {
      logger.warn('Order rejected - trading suspended');
      return null;
    }

    // Rate limiting: max 5 orders/second
    await this.enforceRateLimit(5, 1000);
    
    const orderDetails = this.createOrderObject(signal);
    
    if(!this.validateOrder(orderDetails)) {
      logger.error('Order validation failed', orderDetails);
      return null;
    }

    
    try {
      const order = await this.alpaca.createOrder(orderDetails);
      this.trackOrder(order);
      logger.info(`Order placed: ${order.id}`, order);
      console.log('✅ Order executed successfully:', order.id);
      await redis.xadd('order:logs', '*', 'order', JSON.stringify(order));
      return order;
    } catch (error) {
      this.handleOrderError(error, orderDetails);
      return null;
    }
  }

  createOrderObject(signal) {
    return {
      symbol: signal.symbol,
      qty: signal.qty,
      side: signal.side,
      type: 'limit',
      limit_price: signal.limit_price,
      time_in_force: 'day',
      client_order_id: `HFT_${Date.now()}_${this.orderCounter++}`,
      extended_hours: true
    };
  }

  calculateSize(signal) {
    const baseSize = (config.RISK_PER_TRADE * config.PORTFOLIO_VALUE) / 
                    (signal.atr * 1.5);
    return Math.floor(baseSize * this.positionSizeMultiplier);
  }

  calculateLimitPrice(signal) {
    // Implement smart price improvement logic
    const tickSize = 0.01;
    return signal.side === 'buy' 
      ? signal.price * (1 - config.PRICE_IMPROVEMENT)
      : signal.price * (1 + config.PRICE_IMPROVEMENT);
  }

  async enforceRateLimit(maxRequests, interval) {
    const now = Date.now();
    if(now - this.lastOrderTimestamp < interval/1000) {
      await new Promise(resolve => 
        setTimeout(resolve, interval - (now - this.lastOrderTimestamp))
      );
    }
    this.lastOrderTimestamp = Date.now();
  }

  validateOrder(order) {
    return order.qty > 0 &&
           order.limit_price > 0 &&
           ['buy', 'sell'].includes(order.side) &&
           this.positionSizeMultiplier > 0.1;
  }

  trackOrder(order) {
    this.activeOrders.set(order.client_order_id, {
      ...order,
      timestamp: Date.now()
    });
  }

  handleOrderError(error, order) {
    logger.error('Order failed', {
      error: error.response?.data || error.message,
      order
    });
    
    // Implement error recovery logic
    if(error.message.includes('insufficient')) {
      this.triggerProtocol('MARGIN_CALL');
    }
  }

  // Risk protocol implementations
  async cancelAllOrders() {
    try {
      await this.alpaca.cancelAllOrders();
      this.activeOrders.clear();
      logger.info('All orders cancelled');
    } catch (error) {
      logger.error('Failed to cancel orders', error);
    }
  }

  async closePosition(symbol, percentage = 100) {
    try {
      const position = await this.alpaca.getPosition(symbol);
      const qty = Math.floor(position.qty * (percentage/100));
      
      await this.alpaca.createOrder({
        symbol,
        qty: qty.toString(),
        side: position.side === 'long' ? 'sell' : 'buy',
        type: 'market',
        time_in_force: 'day'
      });
      
      logger.info(`Closed ${percentage}% of ${symbol} position`);
    } catch (error) {
      logger.error('Position close failed', { error, symbol });
    }
  }

  suspendTrading(duration) {
    this.tradingSuspended = true;
    setTimeout(() => {
      this.tradingSuspended = false;
      logger.info('Trading suspension lifted');
    }, duration);
  }

  // ... other protocol implementations from previous answer
  setPositionSizeMultiplier(multiplier) {
    this.positionSizeMultiplier = Math.max(0.1, Math.min(1, multiplier));
  }

  // execution/trading-engine.js
// Add these methods to the TradingEngine class

validateOrder(order) {
    const basicValidation = order.qty > 0 &&
                           order.limit_price > 0 &&
                           ['buy', 'sell'].includes(order.side);
  
    const riskValidation = this.positionSizeMultiplier > 0.1 &&
                          !this.tradingSuspended;
  
    return basicValidation && riskValidation;
  }
  
  calculateSize({ atr, riskPerTrade, portfolioValue }) {
    const baseSize = (riskPerTrade * portfolioValue) / (atr * 1.5);
    return Math.floor(baseSize * this.positionSizeMultiplier);
  }

}