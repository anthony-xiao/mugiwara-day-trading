// risk-management/test-circuit-breaker.js
import { PerformanceMonitor } from './circuit-breakers';

const monitor = new PerformanceMonitor();
monitor.update({ profit: 500 });
monitor.update({ profit: -300 });
console.log("Profit Factor:", monitor.profitFactor); // Should be 1.666...