"""
Polygon.io Historical Data Fetcher

Purpose:
- Collects 20+ years of multi-resolution market data for model training
- Aggregates multiple data types into structured format
- Handles Polygon's pagination and rate limits
- Stores data in efficient Parquet format

Data Collected:
1. Minute/Second Aggregates (OHLCV + VWAP)
2. Trades/Quotes Tick Data
3. Corporate Actions (Splits/Dividends)
4. Fundamental Data
5. Reference Data
6. Technical Indicators
"""
"""
Polygon.io Historical Data Fetcher (Corrected)
"""
"""
Polygon.io Historical Data Fetcher
- Aggregates (OHLCV + VWAP)
- Trades and Quotes
- Corporate Actions (Splits and Dividends)
"""

import os
import requests
import pandas as pd
from datetime import datetime, timedelta
import time
from multiprocessing.pool import ThreadPool
import pytz
import logging
from typing import Dict, List, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler('data_ingestion.log'), logging.StreamHandler()]
)

# Constants
POLYGON_API_KEY = os.getenv('POLYGON_KEY')
BASE_URL = "https://api.polygon.io"
MAX_THREADS = 8
TRADING_DAYS = set()  # Populated during initialization

def is_trading_day(date: datetime) -> bool:
    """Check if a date is a trading day."""
    return date.strftime('%Y-%m-%d') in TRADING_DAYS

def fetch_paginated_data(url: str, params: Dict = None) -> List[Dict]:
    """Handle Polygon pagination with proper URL handling."""
    results = []
    next_url = url
    retries = 0
    max_retries = 5
    
    while next_url:
        try:
            # Add API key directly to URL for next_url case
            if '?' in next_url:
                next_url += f"&apiKey={POLYGON_API_KEY}"
            else:
                next_url += f"?apiKey={POLYGON_API_KEY}"
                
            response = requests.get(next_url, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if response.status_code == 204:  # No content
                break
                
            if "results" in data:
                results.extend(data["results"])
            elif "ticks" in data:  # Trades/quotes
                results.extend(data["ticks"])
            elif "tickers" in data:  # For reference data
                results.extend(data["tickers"])
            
            next_url = data.get("next_url")
            retries = 0
            time.sleep(0.12)  # 8 requests/sec limit
            
        except requests.exceptions.RequestException as e:
            if response.status_code in [404, 422]:  # Don't retry client errors
                break
                
            retries += 1
            if retries > max_retries:
                logging.error(f"Failed after {max_retries} retries: {e}")
                break
            sleep_time = 2 ** retries
            logging.warning(f"Retry {retries} in {sleep_time}s: {e}")
            time.sleep(sleep_time)
            
    return results

def fetch_aggregates(
    ticker: str,
    start: datetime,
    end: datetime,
    multiplier: int = 1,
    timespan: str = "minute"
) -> pd.DataFrame:
    """Fetch OHLCV + VWAP data."""
    url = f"{BASE_URL}/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{start.date().isoformat()}/{end.date().isoformat()}"
    params = {
        "adjusted": "true",
        "sort": "asc",
        "limit": 50000
    }
    
    data = fetch_paginated_data(url, params)
    
    if not data:
        return pd.DataFrame()
        
    df = pd.DataFrame(data)
    df["t"] = pd.to_datetime(df["t"], unit="ms", utc=True)
    return df.rename(columns={
        "t": "timestamp",
        "o": "open",
        "h": "high",
        "l": "low",
        "c": "close",
        "v": "volume",
        "vw": "vwap"
    }).set_index("timestamp")

def fetch_splits(ticker: str) -> pd.DataFrame:
    """Fetch stock splits."""
    url = f"{BASE_URL}/v3/reference/splits"
    params = {"ticker": ticker, "limit": 1000}
    data = fetch_paginated_data(url, params)
    return pd.DataFrame(data)[["execution_date", "split_from", "split_to"]]

def fetch_dividends(ticker: str) -> pd.DataFrame:
    """Fetch dividends."""
    url = f"{BASE_URL}/v3/reference/dividends"
    params = {"ticker": ticker, "limit": 1000}
    data = fetch_paginated_data(url, params)
    return pd.DataFrame(data)[["ex_dividend_date", "cash_amount", "declaration_date"]]

def fetch_trades(ticker: str, date: str) -> pd.DataFrame:
    """Fetch tick-level trades."""
    if not is_trading_day(datetime.strptime(date, "%Y-%m-%d")):
        return pd.DataFrame()
        
    url = f"{BASE_URL}/v3/trades/{ticker}/{date}"
    data = fetch_paginated_data(url)
    
    if not data:
        return pd.DataFrame()
        
    df = pd.DataFrame(data)
    df["timestamp"] = pd.to_datetime(df["sip_timestamp"], utc=True)
    return df[["timestamp", "price", "size", "conditions"]]

def fetch_quotes(ticker: str, date: str) -> pd.DataFrame:
    """Fetch NBBO quotes."""
    if not is_trading_day(datetime.strptime(date, "%Y-%m-%d")):
        return pd.DataFrame()
        
    url = f"{BASE_URL}/v3/quotes/{ticker}/{date}"
    data = fetch_paginated_data(url)
    
    if not data:
        return pd.DataFrame()
        
    df = pd.DataFrame(data)
    df["timestamp"] = pd.to_datetime(df["sip_timestamp"], utc=True)
    return df[[
        "timestamp", "bid_price", "bid_size", 
        "ask_price", "ask_size", "indicators"
    ]]

def initialize_trading_days():
    """Initialize trading calendar."""
    global TRADING_DAYS
    TRADING_DAYS = set()
    
    # Fetch market holidays
    url = f"{BASE_URL}/v1/marketstatus/upcoming"
    try:
        response = requests.get(url, params={"apiKey": POLYGON_API_KEY})
        response.raise_for_status()
        market_status = response.json()
        
        # Get all trading days between 2000-01-01 and today
        start_date = "2000-01-01"
        end_date = datetime.now().strftime("%Y-%m-%d")
        
        # Fetch all market holidays
        holidays_url = f"{BASE_URL}/v1/marketstatus/upcoming"
        holidays_response = requests.get(holidays_url, params={
            "apiKey": POLYGON_API_KEY,
            "from": start_date,
            "to": end_date
        })
        holidays_response.raise_for_status()
        holidays_data = holidays_response.json()
        
        # Create a set of all dates between start and end
        all_dates = pd.date_range(start_date, end_date, freq='B')  # Business days
        
        # Filter out holidays
        holidays = {datetime.strptime(d["date"], "%Y-%m-%d").date() 
                   for d in holidays_data if d["status"] == "closed"}
        
        # Create trading days set
        TRADING_DAYS = {
            date.date().isoformat() 
            for date in all_dates 
            if date.date() not in holidays
        }
        
        logging.info(f"Initialized {len(TRADING_DAYS)} trading days from {start_date} to {end_date}")
        
    except Exception as e:
        logging.error(f"Failed to initialize trading calendar: {str(e)}")
        # Fallback to weekdays if API fails
        start_date = datetime(2000, 1, 1)
        end_date = datetime.now()
        all_dates = pd.date_range(start_date, end_date, freq='B')
        TRADING_DAYS = {date.date().isoformat() for date in all_dates}
        logging.warning(f"Using fallback calendar with {len(TRADING_DAYS)} weekdays")

def fetch_all_data(ticker: str, start_date: str, end_date: str) -> Dict[str, str]:
    """Fetch all data for a ticker."""
    os.makedirs(f"data/historical/{ticker}", exist_ok=True)
    results = {}
    
    try:
        # Aggregates
        for res in [("second", 1), ("minute", 1), ("day", 1)]:
            df = fetch_aggregates(
                ticker,
                datetime.strptime(start_date, "%Y-%m-%d"),
                datetime.strptime(end_date, "%Y-%m-%d"),
                res[1], res[0]
            )
            if not df.empty:
                path = f"data/historical/{ticker}/aggregates_{res[0]}.parquet"
                df.to_parquet(path)
                results[f"aggregates_{res[0]}"] = path

        # Corporate Actions (Splits and Dividends)
        splits = fetch_splits(ticker)
        dividends = fetch_dividends(ticker)
        if not splits.empty or not dividends.empty:
            corp_actions = pd.concat([splits, dividends], axis=1)
            path = f"data/historical/{ticker}/corporate_actions.parquet"
            corp_actions.to_parquet(path)
            results["corporate_actions"] = path

        # Tick Data
        dates = pd.date_range(start_date, end_date, freq="D")
        
        def process_date(date: datetime) -> Tuple[str, pd.DataFrame, pd.DataFrame]:
            date_str = date.strftime("%Y-%m-%d")
            if not is_trading_day(date):
                return (date_str, pd.DataFrame(), pd.DataFrame())
            return (
                date_str,
                fetch_trades(ticker, date_str),
                fetch_quotes(ticker, date_str)
            )

        with ThreadPool(MAX_THREADS) as pool:
            for date_str, trades, quotes in pool.imap(process_date, dates):
                if not trades.empty:
                    path = f"data/historical/{ticker}/trades_{date_str}.parquet"
                    trades.to_parquet(path)
                    results.setdefault("trades", []).append(path)
                if not quotes.empty:
                    path = f"data/historical/{ticker}/quotes_{date_str}.parquet"
                    quotes.to_parquet(path)
                    results.setdefault("quotes", []).append(path)
                    
    except Exception as e:
        logging.error(f"Critical error processing {ticker}: {str(e)}")
        
    return results

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Fetch Polygon.io historical data")
    parser.add_argument("--init-only", action="store_true", 
                       help="Initialize trading calendar only")
    parser.add_argument("tickers", nargs="*", help="Stock tickers")
    parser.add_argument("--start", help="Start date YYYY-MM-DD")
    parser.add_argument("--end", default=datetime.now().strftime("%Y-%m-%d"))
    parser.add_argument("--threads", type=int, default=MAX_THREADS)
    
    args = parser.parse_args()
    
    if args.init_only:
        initialize_trading_days()
        logging.info(f"Initialized {len(TRADING_DAYS)} trading days")
        exit(0)
        
    if not args.tickers or not args.start:
        parser.error("tickers and --start required when not using --init-only")
    
    # Initialize trading calendar if not already done
    if not TRADING_DAYS:
        initialize_trading_days()
    
    def process_ticker(ticker: str):
        logging.info(f"Starting {ticker}")
        try:
            return fetch_all_data(ticker, args.start, args.end)
        except Exception as e:
            logging.error(f"Failed {ticker}: {str(e)}")
            return None

    with ThreadPool(min(args.threads, len(args.tickers))) as pool:
        results = pool.map(process_ticker, args.tickers)
    
    success_count = sum(1 for r in results if r)
    logging.info(f"Completed with {success_count}/{len(args.tickers)} successful tickers")