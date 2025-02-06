// execution/test-order.js
import { executeOrder } from './alpaca-router.js';

const testSignal = {
  symbol: 'AAPL',
  direction: 'buy',
  price: 150.25,
  atr: 1.2
};

executeOrder(testSignal).catch(console.error);