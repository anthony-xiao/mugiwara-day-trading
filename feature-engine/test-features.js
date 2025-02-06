// feature-engine/test-features.mjs
import { calculateVWAPDeviation } from './realtime-features.mjs';

const testData = {
  lastPrice: 150.25,
  vwap: 149.80,
  atr5: 0.75
};

console.log("VWAP Deviation:", calculateVWAPDeviation(testData));