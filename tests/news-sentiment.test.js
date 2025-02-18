import { NewsSentimentAnalyzer } from '../../feature-engineering/news-sentiment.js';
import { mockNewsAPI } from '../mocks/news-api-mock.js';

describe('News Sentiment Analysis', () => {
  it('should process negative news correctly', async () => {
    const analyzer = new NewsSentimentAnalyzer();
    analyzer.sources.NewsAPI = mockNewsAPI.withNegativeNews();
    
    const score = await analyzer.getCompositeSentiment('AAPL');
    expect(score).toBeLessThan(-0.5);
  });

  it('should ignore low-content articles', async () => {
    const analyzer = new NewsSentimentAnalyzer();
    analyzer.sources.NewsAPI = mockNewsAPI.withShortArticles();
    
    const score = await analyzer.getCompositeSentiment('TSLA');
    expect(score).toEqual(0);
  });
});