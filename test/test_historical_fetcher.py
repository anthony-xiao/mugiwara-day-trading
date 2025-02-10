import pytest
import pandas as pd
import os
from datetime import datetime

@pytest.fixture
def test_ticker():
    return "AAPL"

# def test_initialize_calendar():
#     os.system("python ../data-ingestion/historical-data-fetcher.py --init-only")
#     assert os.path.exists("data_ingestion.log")

def test_fetch_aggregates(test_ticker):
    # os.system(f"python ../data-ingestion/historical-data-fetcher.py --start 2023-01-01 --end 2023-01-05 --threads 2 {test_ticker}")
    assert os.path.exists(f"../data/historical/{test_ticker}/aggregates_minute.parquet")
    
    df = pd.read_parquet(f"../data/historical/{test_ticker}/aggregates_minute.parquet")
    assert set(df.columns) == {"timestamp", "open", "high", "low", "close", "volume", "vwap"}
    assert df.index.dtype == "datetime64[ns, UTC]"

def test_fetch_trades(test_ticker):
    assert os.path.exists(f"../data/historical/{test_ticker}/trades_2023-01-03.parquet")
    
    df = pd.read_parquet(f"../data/historical/{test_ticker}/trades_2023-01-03.parquet")
    assert set(df.columns) == {"timestamp", "price", "size", "conditions"}
    assert df["timestamp"].dtype == "datetime64[ns, UTC]"

def test_fetch_quotes(test_ticker):
    assert os.path.exists(f"../data/historical/{test_ticker}/quotes_2023-01-03.parquet")
    
    df = pd.read_parquet(f"../data/historical/{test_ticker}/quotes_2023-01-03.parquet")
    assert set(df.columns) == {"timestamp", "bid_price", "bid_size", "ask_price", "ask_size", "indicators"}
    assert df["timestamp"].dtype == "datetime64[ns, UTC]"

def test_fetch_corporate_actions(test_ticker):
    assert os.path.exists(f"../data/historical/{test_ticker}/corporate_actions.parquet")
    
    df = pd.read_parquet(f"../data/historical/{test_ticker}/corporate_actions.parquet")
    assert set(df.columns) == {"execution_date", "split_from", "split_to", "ex_dividend_date", "cash_amount", "declaration_date"}