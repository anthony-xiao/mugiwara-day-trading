// test/execution/trading-engine.test.js
import { expect } from 'chai';
import sinon from 'sinon';
import { TradingEngine } from '../../execution/trading-engine.js';
import config from '../../shared/config.js';

describe('Trading Engine', () => {
  let engine;
  let mockAlpaca;

  beforeEach(() => {
    mockAlpaca = {
      createOrder: sinon.stub().resolves({ id: 'test-order' }),
      cancelAllOrders: sinon.stub().resolves()
    };
    
    engine = new TradingEngine();
    engine.alpaca = mockAlpaca;
  });

  describe('Order Validation', () => {
    it('should validate correct orders', () => {
      const validOrder = {
        qty: 100,
        limit_price: 100.50,
        side: 'buy'
      };
      expect(engine.validateOrder(validOrder)).to.be.true;
    });

    it('should reject invalid orders', () => {
      const invalidOrders = [
        { qty: 0, limit_price: 100, side: 'buy' },
        { qty: 100, limit_price: 0, side: 'sell' },
        { qty: 100, limit_price: 100, side: 'invalid' }
      ];
      
      invalidOrders.forEach(order => {
        expect(engine.validateOrder(order)).to.be.false;
      });
    });
  });

  describe('Position Sizing', () => {
    it('should calculate correct position size', () => {
      const signal = {
        atr: 1.5,
        riskPerTrade: 0.01,
        portfolioValue: 100000
      };
      
      const size = engine.calculateSize(signal);
      expect(size).to.equal(Math.floor((0.01 * 100000) / (1.5 * 1.5)));
    });

    it('should respect position size multiplier', () => {
      engine.positionSizeMultiplier = 0.5;
      const signal = {
        atr: 1.5,
        riskPerTrade: 0.01,
        portfolioValue: 100000
      };
      
      const size = engine.calculateSize(signal);
      expect(size).to.equal(Math.floor((0.01 * 100000) / (1.5 * 1.5) * 0.5));
    });
  });

  describe('Order Execution', () => {
    it('should place valid orders', async () => {
      const order = await engine.placeOrder({
        symbol: 'TSLA',
        qty: '10' ,
        side: 'buy',
        type: 'limit' ,
        limit_price: '150.25',
        time_in_force: 'day' ,
        client_order_id: 'HFT_1738923130294_2',
        extended_hours: 'true',
        atr: 1.5
      });
      
      expect(order).to.exist;
      expect(mockAlpaca.createOrder.calledOnce).to.be.true;
    });

    it('should reject orders when suspended', async () => {
      engine.tradingSuspended = true;
      const order = await engine.placeOrder({
        symbol: 'AAPL',
        side: 'buy',
        price: 150,
        atr: 1.5
      });
      
      expect(order).to.be.null;
    });
  });
});