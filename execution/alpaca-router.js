// execution/alpaca-router.js
import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true
});

async function executeOrder(signal) {
  // Smart Order Routing Logic
  const order = {
    symbol: signal.symbol,
    qty: calculatePositionSize(signal),
    side: signal.direction,
    type: 'limit',
    limit_price: signal.price * 0.9995, // Price improvement
    time_in_force: 'ioc',
    client_order_id: `HFT_${Date.now()}`
  };
  
  // Anti-Gaming Check
  if(await checkOrderValidity(order)) {
    await alpaca.placeOrder(order);
  }
}

function calculatePositionSize(signal) {
  // ATR-based position sizing
  return Math.floor((riskPerTrade * portfolioValue) / (signal.atr * 1.5));
}