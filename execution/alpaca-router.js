// execution/alpaca-router.js
import { TradingEngine } from './trading-engine.js';
import config from '../shared/config.js';

// Initialize shared instance
export const tradingEngine = new TradingEngine();

// Modified executeOrder function
export async function executeOrder(signal) {
  // console.log('websocket signal',signal)
  try {
    // Create order object using trading engine
    const order = tradingEngine.createOrderObject({
      symbol: signal.symbol,
      qty: signal.quantity.toString(), // Must be string in v3
      side: signal.direction,
      type: 'limit',
      limit_price: signal.limit_price.toString(), // Must be string
      time_in_force: 'day',
      client_order_id: `HFT_${Date.now()}`,
      atr: signal.atr
    });

    // Validate using trading engine's method
    if(!tradingEngine.validateOrder(order)) {
      throw new Error('Order validation failed');
    }

    // Execute through trading engine
    const response = await tradingEngine.placeOrder(order);
    return response;
  } catch (error) {
    console.error('Order Error:', error.response?.data || error.message);
    throw error;
  }
}

// Updated position size calculation using trading engine
export function calculatePositionSize(signal) {
  return tradingEngine.calculateSize({
    atr: signal.atr,
    riskPerTrade: config.RISK_PER_TRADE,
    portfolioValue: config.PORTFOLIO_VALUE
  });
}