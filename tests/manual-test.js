// test/manual-test.js
import { TradingEngine } from '../execution/trading-engine.js';
import { executeOrder, calculatePositionSize } from '../execution/alpaca-router.js';
import config from '../shared/config.js';

// Initialize trading engine
const tradingEngine = new TradingEngine();

// 1. Order Validation Test
function testOrderValidation() {
  console.log('\n=== Testing Order Validation ===');
  
  const validOrder = {
    symbol: 'AAPL',
    qty: 100,
    limit_price: 150.50,
    side: 'buy'
  };

  const invalidOrder = {
    symbol: 'AAPL',
    qty: 0,
    limit_price: 150.50,
    side: 'buy'
  };

  console.log('Valid Order:', tradingEngine.validateOrder(validOrder));
  console.log('Invalid Order:', tradingEngine.validateOrder(invalidOrder));
}

// 2. Position Sizing Test
function testPositionSizing() {
  console.log('\n=== Testing Position Sizing ===');
  
  const signal = {
    symbol: 'AAPL',
    atr: 1.5,
    price: 150,
    direction: 'buy'
  };

  console.log('Position Size:', calculatePositionSize(signal));
}

// 3. Full Integration Test
async function testOrderExecution() {
  console.log('\n=== Testing Order Execution ===');
  
  const signal = {
        symbol: 'TSLA',
        quantity: 10 ,
        direction: 'buy',
        price: 150.25
  };

  try {
    console.log('Placing test order...');
    const order = await executeOrder(signal);
    console.log('Order Executed:', order);
  } catch (error) {
    console.error('Order Failed:', error);
  }
}

// Main test runner
async function runTests() {
  try {
    testOrderValidation();
    testPositionSizing();
    await testOrderExecution();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run all tests
runTests();