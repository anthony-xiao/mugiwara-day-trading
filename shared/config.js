// shared/config.js
import dotenv from 'dotenv';

dotenv.config();

export default {
    RISK_PER_TRADE: 0.01, // 1% of portfolio per trade
    PORTFOLIO_VALUE: 100000, // Starting capital
    MAX_POSITION_ATR_MULTIPLIER: 1.5,
    ALPACA_KEY: process.env.ALPACA_API_KEY,
    ALPACA_SECRET: process.env.ALPACA_SECRET_KEY,
    POLYGON_KEY: process.env.POLYGON_API_KEY,
    REDIS_URL: process.env.REDIS_URL
  };

