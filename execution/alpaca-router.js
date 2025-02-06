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

export async function executeOrder(signal) {
  const order = {
    symbol: signal.symbol,
    qty: calculatePositionSize(signal),
    side: signal.direction,
    type: 'limit',
    limit_price: signal.price * 0.9995,
    time_in_force: 'ioc',
    client_order_id: `HFT_${Date.now()}`
  };

  if (await checkOrderValidity(order)) {
    try {
      const result = await alpaca.placeOrder(order);
      console.log(`Order executed: ${result.id}`);
      return result;
    } catch (error) {
      console.error('Order failed:', error.message);
      throw error;
    }
  }
  return null;
}

function calculatePositionSize(signal) {
  return Math.floor((RISK_PER_TRADE * PORTFOLIO_VALUE) / (signal.atr * 1.5));
}