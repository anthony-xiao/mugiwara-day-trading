// tests/order-imbalance.test.js
import { OrderBookManager } from '../data-ingestion/orderbook-manager.js';
import { FeatureEngine } from '../feature-engine/realtime-features.js';
import { strict as assert } from 'assert';

async function testOrderImbalance() {
    const symbol = 'TEST';
    const bookManager = new OrderBookManager(symbol);
    await bookManager.clear();
  
    // Test case 1: Balanced book
    await bookManager.updateBook({
      bids: [{ price: 150, size: 500 }],
      asks: [{ price: 151, size: 500 }]
    });
    
    const engine = new FeatureEngine(symbol);
    let imbalance = await engine._calculateOrderImbalance();
    assert.equal(imbalance, 0, 'Balanced book should have 0 imbalance');
  
    // Test case 2: Bid-heavy
    await bookManager.updateBook({
      bids: [{ price: 150, size: 1000 }],
      asks: [{ price: 151, size: 500 }]
    });
    imbalance = await engine._calculateOrderImbalance();

    assert.equal(imbalance.toFixed(2), '0.33', 'Expected (1000-500)/1500 ≈ 0.33');
  
    // Test case 3: Ask-heavy
    await bookManager.updateBook({
      bids: [{ price: 150, size: 300 }],
      asks: [{ price: 151, size: 900 }]
    });
    imbalance = await engine._calculateOrderImbalance();
    assert.equal(imbalance.toFixed(2), '-0.50', 'Expected (300-900)/1200 ≈ -0.50');
  
    await bookManager.clear();
    console.log('Order imbalance tests passed');
  }

testOrderImbalance().catch(console.error);