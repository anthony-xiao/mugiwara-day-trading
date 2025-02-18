import { NewsSentimentAnalyzer } from '../feature-engine/news-sentiment.js';

const historicalData = await loadTrainingData(); // Implement this
const analyzer = await NewsSentimentAnalyzer.init();

// Find optimal threshold
const results = historicalData.map(({ text, actualImpact }) => ({
  score: analyzer.getCompositeSentiment(text),
  actual: actualImpact
}));

// Find best threshold that maximizes F1-score
let bestThreshold = -1;
let bestF1 = 0;

for (let threshold = -1; threshold <= 1; threshold += 0.05) {
  const f1 = calculateF1(results, threshold);
  if (f1 > bestF1) {
    bestF1 = f1;
    bestThreshold = threshold;
  }
}

console.log(`Optimal threshold: ${bestThreshold.toFixed(2)}`);