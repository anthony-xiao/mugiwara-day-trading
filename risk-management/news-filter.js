import { NewsSentimentAnalyzer, SENTIMENT_THRESHOLD } from '../feature-engine/news-sentiment.js';

export class NewsSentimentFilter {
  constructor(analyzer) {
    this.analyzer = analyzer;
    this.blocklist = new Map();
  }

  static async init() {
    const analyzer = await NewsSentimentAnalyzer.init();
    return new NewsSentimentFilter(analyzer);
  }

  async validateTrade(symbol, direction) {
    if (this.blocklist.has(symbol)) { // Fixed syntax
      if (Date.now() < this.blocklist.get(symbol)) {
        return { valid: false, reason: 'News block active' };
      }
      this.blocklist.delete(symbol);
    }

    const score = await this.analyzer.getCompositeSentiment(symbol);
    
    if (score < SENTIMENT_THRESHOLD) { // Now using the threshold
      this.blocklist.set(symbol, Date.now() + 300000);
      return { valid: false, reason: `Negative sentiment: ${score.toFixed(2)}` };
    }
    
    return { valid: true };
  }
}