import pytest
from datetime import datetime, timedelta
from data-ingestion.historical-data-fetcher import (
    fetch_aggregates,
    fetch_corporate_actions,
    fetch_trades,
    fetch_quotes
)
import pandas as pd
import os
import pytz

@pytest.fixture
def test_ticker():
    return "AAPL"  # Use AAPL as test ticker

def test_fetch_aggregates_v2(test_ticker):
    start = datetime(2023, 1, 1)
    end = datetime(2023, 1, 5)
    df = fetch_aggregates(test_ticker, start, end)
    
    assert not df.empty
    assert len(df) >= 390  # 390 mins/day * 3 trading days
    assert "vwap" in df.columns
    assert df.index.tz == pytz.UTC

def test_fetch_corporate_actions_v3(test_ticker):
    splits, dividends = fetch_corporate_actions(test_ticker)
    assert not splits.empty
    assert "split_from" in splits.columns
    assert not dividends.empty
    assert "dividend" in dividends.columns

def test_fetch_trades_v3(test_ticker):
    date_str = "2023-01-04"
    df = fetch_trades(test_ticker, date_str)
    assert not df.empty
    assert "price" in df.columns
    assert df["timestamp"].dt.tz == pytz.UTC

def test_fetch_quotes_v3(test_ticker):
    date_str = "2023-01-04"
    df = fetch_quotes(test_ticker, date_str)
    assert not df.empty
    assert "bid_price" in df.columns
    assert "ask_size" in df.columns

def test_full_pipeline(tmp_path, test_ticker):
    os.environ["POLYGON_KEY"] = "test_key"
    from data-ingestion.historical-data-fetcher import fetch_all_data
    
    result = fetch_all_data(test_ticker, "2023-01-03", "2023-01-05")
    
    # Verify aggregates
    assert "aggregates_minute" in result
    agg_df = pd.read_parquet(result["aggregates_minute"])
    assert len(agg_df) >= 780  # 2 days * 390 minutes
    
    # Verify corporate actions
    assert "splits" in result
    assert "dividends" in result
    
    # Verify tick data
    assert len(result.get("trades", [])) >= 2
    trade_df = pd.read_parquet(result["trades"][0])
    assert "price" in trade_df.columns