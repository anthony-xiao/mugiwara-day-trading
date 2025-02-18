"""
Robust Sentiment Model Training with Alpha Vantage News & Polygon Data
"""

import os
from dotenv import load_dotenv
import requests
import numpy as np
import tensorflow as tf
from datetime import datetime, timedelta
import time
import logging
from retrying import retry
from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
from sklearn.model_selection import train_test_split

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler('sentiment_training.log'), logging.StreamHandler()]
)

# API Configuration
load_dotenv()
ALPHAVANTAGE_KEY = os.getenv('ALPHAVANTAGE_KEY')
POLYGON_API_KEY = os.getenv('POLYGON_API_KEY')
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds

def retry_if_api_error(exception):
    """Retry on API-related errors"""
    return isinstance(exception, (requests.exceptions.RequestException, KeyError))

@retry(retry_on_exception=retry_if_api_error, stop_max_attempt_number=MAX_RETRIES, wait_fixed=RETRY_DELAY*1000)
def fetch_financial_news(symbol="SPY", days=30):
    """Fetch historical news with sentiment scores using Alpha Vantage"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    news = []
    logging.info(f"Fetching news for {symbol} from {start_date.date()} to {end_date.date()}")
    
    try:
        url = "https://www.alphavantage.co/query"
        params = {
            'function': 'NEWS_SENTIMENT',
            'tickers': symbol,
            'time_from': start_date.strftime('%Y%m%dT0000'),
            'time_to': end_date.strftime('%Y%m%dT2359'),
            'sort': 'LATEST',
            'limit': 2,
            'apikey': ALPHAVANTAGE_KEY
        }
        
        response = requests.get(url, params=params, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        # Validate API response structure
        if not isinstance(data.get('feed'), list):
            raise ValueError("Invalid Alpha Vantage response format")
            
        for article in data['feed']:
            try:
                # Validate required fields
                if not all(key in article for key in ['time_published', 'title']):
                    continue
                    
                published_at = datetime.fromisoformat(
                    article['time_published'].replace('Z', '+00:00')
                )
                text = f"{article['title']}. {article.get('summary', '')}"
                
                if len(text) < 50:  # Skip short articles
                    continue
                
                # Validate sentiment score
                sentiment = float(article.get('overall_sentiment_score', 0))
                label = get_market_reaction(symbol, published_at)
                
                if label is not None:
                    news.append((text, label, sentiment))
                    
            except (KeyError, ValueError) as e:
                logging.warning(f"Skipping invalid article: {str(e)}")
                continue
                
        return news
        
    except Exception as e:
        logging.error(f"Alpha Vantage API error: {str(e)}")
        return []

@retry(retry_on_exception=retry_if_api_error, stop_max_attempt_number=MAX_RETRIES, wait_fixed=RETRY_DELAY*1000)
def get_market_reaction(symbol, event_time):
    """Get percentage price change using Polygon.io aggregates"""
    try:
        # Convert to US Eastern Time
        eastern = pytz.timezone('US/Eastern')
        event_time_eastern = event_time.astimezone(eastern)
        
        # Get previous and next trading days
        prev_day = event_time_eastern - timedelta(days=1)
        next_day = event_time_eastern + timedelta(days=1)
        
        # Fetch aggregates from Polygon
        def fetch_daily_agg(date):
            url = f"https://api.polygon.io/v2/aggs/ticker/{symbol}/1/day/{date}/{date}"
            response = requests.get(url, params={'adjusted': 'true', 'apiKey': POLYGON_API_KEY}, timeout=10)
            response.raise_for_status()
            data = response.json()
            return data['results'][0] if data.get('results') else None
            
        prev_data = None
        next_data = None
        
        # Find nearest trading days
        for offset in range(0, 3):
            check_date = (event_time_eastern - timedelta(days=offset)).strftime('%Y-%m-%d')
            prev_data = fetch_daily_agg(check_date)
            if prev_data:
                break
                
        for offset in range(0, 3):
            check_date = (event_time_eastern + timedelta(days=offset)).strftime('%Y-%m-%d')
            next_data = fetch_daily_agg(check_date)
            if next_data:
                break
                
        if not prev_data or not next_data:
            return None
            
        prev_close = prev_data['c']
        next_close = next_data['c']
        
        pct_change = (next_close - prev_close) / prev_close
        if abs(pct_change) < 0.005:
            return 0
        return 1 if pct_change > 0 else -1
        
    except Exception as e:
        logging.error(f"Polygon API error: {str(e)}")
        return None

def validate_training_data(news_data):
    """Ensure we have sufficient training data"""
    if len(news_data) == 0:
        raise ValueError("No valid training samples found. Check API keys and date range.")
        
    class_balance = np.unique([label for _, label, _ in news_data], return_counts=True)
    logging.info(f"Class distribution: {dict(zip(class_balance[0], class_balance[1]))}")
    
    if min(class_balance[1]) < 10:
        raise ValueError("Insufficient samples for some classes. Extend date range.")
        
    return news_data

def preprocess_text(text):
    """Enhanced text cleaning"""
    text = text.lower().replace('\n', ' ')
    text = ''.join([c for c in text if c.isalpha() or c.isspace()])
    return ' '.join(text.split()[:500])  # Truncate long texts

def train_model(news_data):
    """Train TF model on processed news data"""
    try:
        texts, labels, _ = zip(*news_data)
    except ValueError:
        raise ValueError("No valid training data available")
    
    # Train/Test split
    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42
    )
    
    # Vectorize text
    vectorizer = tf.keras.layers.TextVectorization(
        max_tokens=10000,
        output_sequence_length=100
    )
    vectorizer.adapt(X_train)
    
    # Build model
    model = tf.keras.Sequential([
        vectorizer,
        tf.keras.layers.Embedding(10000, 128),
        tf.keras.layers.Bidirectional(tf.keras.layers.LSTM(64)),
        tf.keras.layers.Dense(64, activation='relu'),
        tf.keras.layers.Dense(1, activation='tanh')
    ])
    
    model.compile(
        loss='mse',
        optimizer='adam',
        metrics=['mae']
    )
    
    # Train
    model.fit(
        X_train, y_train,
        validation_data=(X_test, y_test),
        epochs=10,
        batch_size=32
    )
    
    return model

if __name__ == "__main__":
    try:
        # Step 1: Fetch labeled training data
        logging.info("Starting data collection...")
        news_data = fetch_financial_news(days=10, symbol="SPY")
        
        # Step 2: Validate data
        validated_data = validate_training_data(news_data)
        
        # Step 3: Preprocess
        logging.info("Preprocessing data...")
        processed_data = [
            (preprocess_text(text), label)
            for text, label, _ in validated_data
        ]
        
        # Step 4: Train
        logging.info("Training model...")
        model = train_model(processed_data)
        
        # Step 5: Export
        model.save("sentiment_model.keras")
        logging.info("Model saved successfully")
        
        # Convert to TF.js format
        import tensorflowjs as tfjs
        tfjs.converters.save_keras_model(model, "tfjs_model")
        logging.info("TF.js model exported")
        
    except Exception as e:
        logging.error(f"Critical error: {str(e)}")
        exit(1)
