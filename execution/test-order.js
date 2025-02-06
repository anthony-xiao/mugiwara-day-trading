// execution/test-order.js
import { executeOrder } from './alpaca-router.js';

async function testOrder() {
  const testSignal = {
    symbol: 'AAPL',
    direction: 'buy',
    price: '150.25', // Must be string
    quantity: '10' // Must be string
  };

  try {
    const result = await executeOrder(testSignal);
    console.log('Order Result:', result);
  } catch (error) {
    console.error('Test Failed:', error.message);
  }
}

testOrder();