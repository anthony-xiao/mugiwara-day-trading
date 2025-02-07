// shared/config.js
import dotenv from 'dotenv';

dotenv.config();

export default {
    RISK_PER_TRADE: 0.01, // 1% of portfolio per trade
    PORTFOLIO_VALUE: 100000, // Starting capital
    MAX_POSITION_ATR_MULTIPLIER: 1.5,
    PRICE_IMPROVEMENT: 0.0005, // 0.05% price improvement
    MAX_ORDER_RATE: 5, // orders/second
    ALPACA_KEY: process.env.ALPACA_API_KEY,
    ALPACA_SECRET: process.env.ALPACA_SECRET_KEY,
    POLYGON_KEY: process.env.POLYGON_API_KEY,
    REDIS_URL: process.env.REDIS_URL,
    risk: {
      dailyLossLimit: -0.03,  // -3%
      profitFactorThreshold: 1.8,
      volatilityThreshold: 2.5,  // 2.5x average
      maxProtocolTriggers: 3
    },
    stops: {
      hardStop: 1.5,  // 1.5x ATR
      trailingStop: 0.8  // 0.8x ATR
    }
  };
