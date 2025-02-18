import { WordTokenizer, PorterStemmer } from 'natural';
import * as tf from '@tensorflow/tfjs-node';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';

const SEQ_LENGTH = 100;
const VOCAB_PATH = './config/sentiment-vocab.json';
const CACHE_TTL = 300000; // 5 minutes
const SENTIMENT_THRESHOLD = 0.7

class NewsAPIClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://newsapi.org/v2/everything';
  }

  async getCompanyNews(symbol, { from }) {
    try {
      const response = await fetch(
        `${this.baseUrl}?q=${symbol}&from=${new Date(from).toISOString()}&sortBy=publishedAt&apiKey=${this.apiKey}`
      );
      const data = await response.json();
      return data.articles.map(article => ({
        source: 'NewsAPI',
        text: `${article.title}. ${article.description}`,
        timestamp: new Date(article.publishedAt).getTime()
      }));
    } catch (error) {
      console.error('NewsAPI Error:', error);
      return [];
    }
  }
}

class BenzingaClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.benzinga.com/api/v2/news';
  }

  async getMoversNews() {
    try {
      const response = await fetch(`${this.baseUrl}?apikey=${this.apiKey}&parameters[channels]=movers`);
      const data = await response.json();
      return data.map(article => ({
        source: 'Benzinga',
        text: `${article.title}. ${article.teaser}`,
        timestamp: new Date(article.created).getTime()
      }));
    } catch (error) {
      console.error('Benzinga Error:', error);
      return [];
    }
  }
}

class AlphaVantageClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
  }

  async sectorSentiment() {
    try {
      const response = await fetch(
        `${this.baseUrl}?function=NEWS_SENTIMENT&apikey=${this.apiKey}`
      );
      const data = await response.json();
      return data.feed.map(article => ({
        source: 'AlphaVantage',
        text: `${article.title}. ${article.summary}`,
        timestamp: new Date(article.time_published).getTime()
      }));
    } catch (error) {
      console.error('AlphaVantage Error:', error);
      return [];
    }
  }
}

export class NewsSentimentAnalyzer {
  constructor(model) {
    this.tokenizer = new WordTokenizer();
    this.stemmer = PorterStemmer;
    this.tfModel = model;
    this.vocabulary = JSON.parse(readFileSync(VOCAB_PATH));
    this.negativeWords = new Set(['downgrade', 'bankrupt', 'fraud', 'sell', 'cut', 'warning', 'drop']);
    this.positiveWords = new Set(['upgrade', 'buy', 'strong', 'beat', 'raise', 'growth', 'surge']);
    this.memoCache = new Map();
    this.sources = {
      NewsAPI: new NewsAPIClient(process.env.NEWSAPI_KEY),
      Benzinga: new BenzingaClient(process.env.BENZINGA_KEY),
      AlphaVantage: new AlphaVantageClient(process.env.ALPHAVANTAGE_KEY)
    };

    // Cache cleanup every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, { expiry }] of this.memoCache) {
        if (now > expiry) this.memoCache.delete(key);
      }
    }, 60000);
  }

  static async init() {
    const model = await tf.loadLayersModel('file://./models/sentiment-model/model.json');
    return new NewsSentimentAnalyzer(model);
  }

  async getCompositeSentiment(symbol) {
    try {
      const articles = await this._fetchRecentArticles(symbol);
      return articles.length > 0 ? this._analyzeArticles(articles) : 0;
    } catch (error) {
      console.error('Sentiment Analysis Error:', error);
      return 0;
    }
  }

  async _fetchRecentArticles(symbol) {
    const [newsAPI, benzinga, alphaVantage] = await Promise.allSettled([
      this.sources.NewsAPI.getCompanyNews(symbol, { from: Date.now() - 3600000 }),
      this.sources.Benzinga.getMoversNews(),
      this.sources.AlphaVantage.sectorSentiment()
    ]);

    return [
      ...this._processFetched(newsAPI),
      ...this._processFetched(benzinga),
      ...this._processFetched(alphaVantage)
    ].filter(article => article.text.length > 50);
  }

  _processFetched(result) {
    return result.status === 'fulfilled' ? result.value : [];
  }

  _textToTensor(text) {
    // Preprocessing Optimization with caching
    const cacheKey = text.substring(0, 500).toLowerCase();
    if (this.memoCache.has(cacheKey)) {
      return this.memoCache.get(cacheKey).tensor;
    }
    // 1. Clean and normalize text
    const cleanText = text.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
    
    // 2. Tokenize and stem
    const tokens = this.tokenizer.tokenize(cleanText)
      .map(token => this.stemmer.stem(token))
      .filter(token => token.length > 2);

    // 3. Convert to numerical indices
    const indices = tokens.map(token => 
      this.vocabulary[token] || this.vocabulary['<UNK>']
    );

    // 4. Pad/truncate sequence
    const padded = Array(SEQ_LENGTH).fill(0);
    indices.slice(0, SEQ_LENGTH).forEach((val, idx) => padded[idx] = val);

    const tensor = tf.tensor2d([padded], [1, SEQ_LENGTH]);
    this.memoCache.set(cacheKey, {
      tensor,
      expiry: Date.now() + CACHE_TTL
    });

    return tensor;
  }

  _analyzeArticles(articles) {
    const scores = articles.map(article => {
      const tensor = this._textToTensor(article.text);
      const tfScore = this.tfModel.predict(tensor).dataSync()[0];
      const ruleScore = this._ruleBasedScore(article.text);
      return (0.7 * tfScore) + (0.3 * ruleScore);
    });

    return scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
  }

  _ruleBasedScore(text) {
    let score = 0;
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    
    tokens.forEach(token => {
      if (this.negativeWords.has(token)) score -= 1;
      if (this.positiveWords.has(token)) score += 1;
    });
    
    return Math.max(-1, Math.min(1, score / 5));
  }
}