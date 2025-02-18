import { NewsSentimentFilter } from '../../risk-management/news-filter.js';

describe('News Filter', () => {
  it('should respect threshold', async () => {
    const filter = await NewsSentimentFilter.init();
    filter.analyzer.getCompositeSentiment = async () => -0.8;
    
    const result = await filter.validateTrade('TEST');
    expect(result.valid).toBe(false);
  });
});