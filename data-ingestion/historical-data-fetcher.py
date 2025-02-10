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
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse
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
    """Handle Polygon pagination with loop prevention"""
    results = []
    next_url = url
    retries = 0
    max_retries = 3
    timeout = 10
    max_pages = 20  # Safety net to prevent infinite loops
    pages_fetched = 0
    seen_cursors = set()
    original_params = params.copy() if params else {}

    logging.info(f"Starting pagination for {next_url}")
    
    while next_url and pages_fetched < max_pages:
        try:
            parsed = urlparse(next_url)
            query = parse_qs(parsed.query)

            # Remove potential conflict parameters
            for key in ["timestamp.gte", "timestamp.lte", "sort", "order"]:
                if key in query:
                    del query[key]
            
            # Merge with original params
            for key, value in original_params.items():
                if isinstance(value, list):
                    query[key] = value
                else:
                    query[key] = [str(value)]
            
            # Extract cursor for loop detection
            cursor = query.get('cursor', [None])[0]
            if cursor in seen_cursors:
                logging.warning(f"Detected duplicate cursor {cursor}, stopping pagination")
                break
            seen_cursors.add(cursor)
            
            # Clean and fetch
            query['apiKey'] = POLYGON_API_KEY
            next_url = urlunparse(parsed._replace(query=urlencode(query, doseq=True)))
            
            logging.info(f"Fetching page {pages_fetched + 1}")
            response = requests.get(next_url, timeout=timeout)
            response.raise_for_status()
            data = response.json()
            
            # Check for empty results
            records = data.get('results', data.get('ticks', data.get('tickers', [])))
            if not records:
                logging.info("No more records found")
                break
                
            results.extend(records)
            pages_fetched += 1
            logging.info(f"Received {len(records)} records (total: {len(results)})")
            
            # Update next URL
            next_url = data.get('next_url')
            time.sleep(0.3)

        except Exception as e:
            if retries >= max_retries:
                logging.error(f"Aborting after {max_retries} retries: {str(e)}")
                break
            retries += 1
            sleep_time = min(2 ** retries, 10)
            logging.warning(f"Retry {retries}/{max_retries} in {sleep_time}s: {str(e)}")
            time.sleep(sleep_time)
    
    logging.info(f"Completed pagination after {pages_fetched} pages")
    return results


def fetch_aggregates(
    ticker: str,
    start: datetime,
    end: datetime,
    multiplier: int = 1,
    timespan: str = "minute"
) -> pd.DataFrame:
    """Fetch OHLCV + VWAP data."""
    start_utc = pd.Timestamp(start).tz_localize('UTC')
    end_utc = pd.Timestamp(end).tz_localize('UTC')

    url = f"{BASE_URL}/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{start.date().isoformat()}/{end.date().isoformat()}"
    params = {
        "adjusted": "true",
        "sort": "asc",
        "limit": 50000
    }
    
    logging.info(f"Fetching {timespan} aggregates from {start_utc} to {end_utc}")
    data = fetch_paginated_data(url, params)
    
    if not data:
        return pd.DataFrame()
        
    df = pd.DataFrame(data)
    df["t"] = pd.to_datetime(df["t"], unit="ms", utc=True)
    logging.info(f"Fetched {len(df)} {timespan} aggregates for {ticker}")

    df = df.rename(columns={
        "t": "timestamp",
        "o": "open",
        "h": "high",
        "l": "low",
        "c": "close",
        "v": "volume",
        "vw": "vwap"
    }).set_index("timestamp")
    
    # Filter to exact date range (API sometimes returns extra)
    mask = (df.index >= start_utc) & (df.index <= end_utc)
    filtered_df = df[mask]
    logging.info(f"Filtered to {len(filtered_df)}/{len(df)} records in range")
    return filtered_df


def fetch_splits(ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch splits with optimized parameters"""
    start_time = time.time()
    logging.info(f"🔄 Starting splits fetch for {ticker}")
    
    try:
        url = f"{BASE_URL}/v3/reference/splits"
        params = {
            "ticker": ticker,
            "execution_date.gte": start_date,
            "execution_date.lte": end_date,
            "limit": 1000
        }
        
        data = fetch_paginated_data(url, params)
        if not data:
            logging.info(f"✅ No splits found for {ticker}")
            return pd.DataFrame()
            
        df = pd.DataFrame(data)
        df["execution_date"] = pd.to_datetime(df["execution_date"])
        logging.info(f"⏱️ Fetched {len(data)} splits in {time.time()-start_time:.2f}s")
        return df[["execution_date", "split_from", "split_to"]]
        
    except Exception as e:
        logging.error(f"❌ Split fetch failed after {time.time()-start_time:.2f}s: {str(e)}")
        return pd.DataFrame()

def fetch_dividends(ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
    """Fetch dividends with proper URL format"""
    start_time = time.time()
    logging.info(f"🔄 Starting dividends fetch for {ticker}")
    
    try:
        url = f"{BASE_URL}/v3/reference/dividends"
        params = {
            "ticker": ticker,
            "ex_dividend_date.gte": start_date,
            "ex_dividend_date.lte": end_date,
            "limit": 1000
        }
        
        data = fetch_paginated_data(url, params)
        if not data:
            return pd.DataFrame()
        
        logging.info(f"⏱️ Fetched {len(data)} dividends in {time.time()-start_time:.2f}s")
        df = pd.DataFrame(data)
        df["ex_dividend_date"] = pd.to_datetime(df["ex_dividend_date"])
        return df[["ex_dividend_date", "cash_amount", "declaration_date"]]
        
    except Exception as e:
        logging.error(f"❌ Dividends fetch failed after {time.time()-start_time:.2f}s: {str(e)}")
        return pd.DataFrame()
    
def fetch_trades(ticker: str, date: str) -> pd.DataFrame:
    """Fetch trades with proper URL format"""
    start_time = time.time()
    logging.info(f"🔄 Starting trades fetch for {ticker} on {date}")
    
    try:
        url = f"{BASE_URL}/v3/trades/{ticker}"
        params = {
            "timestamp.gte": f"{date}T00:00:00.000Z",
            "timestamp.lte": f"{date}T23:59:59.999Z",
            "limit": 1000,
            "sort": "timestamp",
            "order": "asc"
        }
        
        data = fetch_paginated_data(url, params)
        
        if not data:
            logging.info(f"✅ No trades found for {ticker} on {date}")
            return pd.DataFrame()
        
        logging.info(f"⏱️ Fetched {len(data)} trades in {time.time()-start_time:.2f}s")
        df = pd.DataFrame(data)
        
        # Validate required columns
        required_columns = ["sip_timestamp", "price", "size"]
        for col in required_columns:
            if col not in df.columns:
                raise KeyError(f"Missing required trade column: {col}")
        
        # Handle optional columns
        optional_columns = ["conditions"]
        keep_columns = required_columns.copy()
        for col in optional_columns:
            if col in df.columns:
                keep_columns.append(col)
        
        df["timestamp"] = pd.to_datetime(df["sip_timestamp"], utc=True)
        logging.info(f"⏱️ Fetched {len(df)} trades in {time.time()-start_time:.2f}s")
        return df[keep_columns]
        
    except Exception as e:
        logging.error(f"❌ Trades fetch failed after {time.time()-start_time:.2f}s: {str(e)}")
        return pd.DataFrame()


def fetch_quotes(ticker: str, date: str) -> pd.DataFrame:
    """Fetch quotes with proper URL format"""
    start_time = time.time()
    logging.info(f"🔄 Starting quotes fetch for {ticker} on {date}")
    
    try:
        url = f"{BASE_URL}/v3/quotes/{ticker}"
        params = {
            "timestamp.gte": f"{date}T00:00:00.000Z",
            "timestamp.lte": f"{date}T23:59:59.999Z",
            "limit": 1000,
            "sort": "timestamp",
            "order": "asc"
        }
        
        data = fetch_paginated_data(url, params)
        
        if not data:
            logging.info(f"✅ No quotes found for {ticker} on {date}")
            return pd.DataFrame()
        
        logging.info(f"⏱️ Fetched {len(data)} quotes in {time.time()-start_time:.2f}s")
        df = pd.DataFrame(data)
        
        # Handle missing columns
        expected_columns = {
            "sip_timestamp": True,
            "bid_price": True,
            "bid_size": True,
            "ask_price": True,
            "ask_size": True,
            "indicators": False  # Optional
        }
        
        for col, required in expected_columns.items():
            if col not in df.columns and required:
                raise KeyError(f"Missing required column: {col}")
        
        df["timestamp"] = pd.to_datetime(df["sip_timestamp"], utc=True)
        keep_columns = [col for col in expected_columns if col in df.columns]
        
        logging.info(f"⏱️ Fetched {len(df)} quotes in {time.time()-start_time:.2f}s")
        return df[keep_columns]
        
    except Exception as e:
        logging.error(f"❌ Quotes fetch failed after {time.time()-start_time:.2f}s: {str(e)}")
        return pd.DataFrame()



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
        splits = fetch_splits(ticker, start_date, end_date)
        dividends = fetch_dividends(ticker, start_date, end_date)
        
        if not splits.empty or not dividends.empty:
            corp_actions = pd.concat([splits, dividends], axis=1)
            path = f"data/historical/{ticker}/corporate_actions_{start_date}_to_{end_date}.parquet"
            corp_actions.to_parquet(path)
            results["corporate_actions"] = path

        # Tick Data
        # Trades and Quotes
        dates = pd.date_range(start_date, end_date, freq="D")
        
        def process_date(date: datetime):
            date_str = date.strftime("%Y-%m-%d")
            if not is_trading_day(date):
                logging.info(f"Skipping {date_str} (non-trading day)")
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
                    logging.info(f"Saved trades for {ticker} on {date_str} to {path}")
                if not quotes.empty:
                    path = f"data/historical/{ticker}/quotes_{date_str}.parquet"
                    quotes.to_parquet(path)
                    results.setdefault("quotes", []).append(path)
                    logging.info(f"Saved quotes for {ticker} on {date_str} to {path}")
                    
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