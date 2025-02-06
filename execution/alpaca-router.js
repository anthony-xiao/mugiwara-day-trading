// execution/alpaca-router.js
import Alpaca from '@alpacahq/alpaca-trade-api';
import config from '../shared/config.js';

const alpaca = new Alpaca({
  keyId: config.ALPACA_KEY,
  secretKey: config.ALPACA_SECRET,
  paper: true
});

const RISK_PER_TRADE = config.RISK_PER_TRADE;
const PORTFOLIO_VALUE = config.PORTFOLIO_VALUE;

// Add anti-gaming validation
function checkOrderValidity(order) {
  // Temporary basic validation
  return order.qty > 0 && 
         order.limit_price > 0 && 
         ['buy', 'sell'].includes(order.side);
}

// Correct method usage for v3
export async function executeOrder(signal) {
  try {
    const order = {
      symbol: signal.symbol,
      qty: signal.quantity.toString(), // Must be string in v3
      side: signal.direction,
      type: 'limit',
      limit_price: signal.price.toString(), // Must be string
      time_in_force: 'day',
      client_order_id: `HFT_${Date.now()}`
    };

    const response = await alpaca.createOrder(order);
    return response;
  } catch (error) {
    console.error('Order Error:', error.response?.data || error.message);
    throw error;
  }
}

function calculatePositionSize(signal) {
  return Math.floor((RISK_PER_TRADE * PORTFOLIO_VALUE) / (signal.atr * 1.5));
}