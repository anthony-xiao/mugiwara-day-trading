import pytest
from datetime import datetime
from data-ingestion.historical-data-fetcher 
import (
    fetch_aggregates, fetch_splits, fetch_dividends, fetch_trades
)
import pandas as pd
import os

@pytest.fixture
def test_ticker():
    return "AAPL"

def test_aggregates_v2(test_ticker):
    df = fetch_aggregates(test_ticker, datetime(2023,1,2), datetime(2023,1,3))
    assert not df.empty
    assert "vwap" in df.columns
    assert len(df) >= 780  # 2 days * 390 minutes

def test_splits_v3(test_ticker):
    splits = fetch_splits(test_ticker)
    assert not splits.empty
    assert "split_from" in splits.columns
    assert splits["split_from"].dtype == int

def test_dividends_v3(test_ticker):
    dividends = fetch_dividends(test_ticker)
    assert not dividends.empty
    assert "cash_amount" in dividends.columns
    assert dividends["cash_amount"].dtype == float

def test_trades_v3(test_ticker):
    trades = fetch_trades(test_ticker, "2023-01-04")
    assert not trades.empty
    assert "conditions" in trades.columns
    assert pd.api.types.is_datetime64tz_dtype(trades["timestamp"])

def test_end_to_end(tmp_path, test_ticker):
    os.environ["POLYGON_KEY"] = "test_key"
    from data-ingestion.historical-data-fetcher 
    import fetch_all_data
    
    result = fetch_all_data(test_ticker, "2023-01-03", "2023-01-05")
    
    assert "aggregates_minute" in result
    agg_df = pd.read_parquet(result["aggregates_minute"])
    assert not agg_df.empty
    
    assert "trades" in result
    assert any("2023-01-04" in p for p in result["trades"])