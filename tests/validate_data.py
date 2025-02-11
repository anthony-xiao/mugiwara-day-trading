import pandas as pd
import os

def validate_all_data(ticker: str):
    # Load data
    agg_df = pd.read_parquet(f"data/historical/{ticker}/aggregates_minute.parquet")
    trades_df = pd.read_parquet(f"data/historical/{ticker}/trades_2023-01-03.parquet")
    quotes_df = pd.read_parquet(f"data/historical/{ticker}/quotes_2023-01-03.parquet")
    splits_df = pd.read_parquet(f"data/historical/{ticker}/splits.parquet")
    dividends_df = pd.read_parquet(f"data/historical/{ticker}/dividends.parquet")
    
    # Validate schema
    assert validate_aggregates(agg_df), "Aggregates schema mismatch"
    assert validate_trades(trades_df), "Trades schema mismatch"
    assert validate_quotes(quotes_df), "Quotes schema mismatch"
    assert validate_splits(splits_df), "Splits schema mismatch"
    assert validate_dividends(dividends_df), "Dividends schema mismatch"
    
    # Validate data quality
    assert check_aggregates(agg_df), "Aggregates data quality issue"
    assert check_trades(trades_df), "Trades data quality issue"
    assert check_quotes(quotes_df), "Quotes data quality issue"
    assert check_splits(splits_df), "Splits data quality issue"
    assert check_dividends(dividends_df), "Dividends data quality issue"
    
    # Cross-validate
    assert validate_aggregates_vs_trades(agg_df, trades_df), "Aggregates vs. Trades mismatch"
    assert validate_quotes_vs_trades(quotes_df, trades_df), "Quotes vs. Trades mismatch"
    
    print(f"✅ All data for {ticker} is valid")

if __name__ == "__main__":
    validate_all_data("AAPL")


def validate_aggregates(df: pd.DataFrame) -> bool:
    expected_columns = {
        "timestamp": "datetime64[ns, UTC]",
        "open": "float64",
        "high": "float64",
        "low": "float64",
        "close": "float64",
        "volume": "float64",
        "vwap": "float64"
    }
    return all(df.dtypes.astype(str) == pd.Series(expected_columns))

def validate_trades(df: pd.DataFrame) -> bool:
    expected_columns = {
        "timestamp": "datetime64[ns, UTC]",
        "price": "float64",
        "size": "int64",
        "conditions": "object"
    }
    return all(df.dtypes.astype(str) == pd.Series(expected_columns))

def validate_quotes(df: pd.DataFrame) -> bool:
    expected_columns = {
        "timestamp": "datetime64[ns, UTC]",
        "bid_price": "float64",
        "bid_size": "int64",
        "ask_price": "float64",
        "ask_size": "int64",
        "indicators": "object"
    }
    return all(df.dtypes.astype(str) == pd.Series(expected_columns))

def validate_splits(df: pd.DataFrame) -> bool:
    expected_columns = {
        "execution_date": "datetime64[ns]",
        "split_from": "float64",
        "split_to": "float64"
    }
    return all(df.dtypes.astype(str) == pd.Series(expected_columns))

def validate_dividends(df: pd.DataFrame) -> bool:
    expected_columns = {
        "ex_dividend_date": "datetime64[ns]",
        "cash_amount": "float64",
        "declaration_date": "datetime64[ns]"
    }
    return all(df.dtypes.astype(str) == pd.Series(expected_columns))

def check_aggregates(df: pd.DataFrame) -> bool:
    # Check for missing values
    if df.isnull().any().any():
        return False
    
    # Check OHLC relationships
    if not (df["low"] <= df["open"]).all():
        return False
    if not (df["low"] <= df["close"]).all():
        return False
    if not (df["high"] >= df["open"]).all():
        return False
    if not (df["high"] >= df["close"]).all():
        return False
    
    # Check volume and VWAP
    if (df["volume"] < 0).any():
        return False
    if (df["vwap"] <= 0).any():
        return False
    
    return True

def check_trades(df: pd.DataFrame) -> bool:
    # Check for missing values
    if df.isnull().any().any():
        return False
    
    # Check price and size
    if (df["price"] <= 0).any():
        return False
    if (df["size"] <= 0).any():
        return False
    
    return True

def check_quotes(df: pd.DataFrame) -> bool:
    # Check for missing values
    if df.isnull().any().any():
        return False
    
    # Check bid/ask relationships
    if not (df["bid_price"] <= df["ask_price"]).all():
        return False
    if (df["bid_size"] <= 0).any():
        return False
    if (df["ask_size"] <= 0).any():
        return False
    
    return True

def check_splits(df: pd.DataFrame) -> bool:
    # Check for missing values
    if df.isnull().any().any():
        return False
    
    # Check split ratios
    if (df["split_from"] <= 0).any():
        return False
    if (df["split_to"] <= 0).any():
        return False
    
    return True

def check_dividends(df: pd.DataFrame) -> bool:
    # Check for missing values
    if df.isnull().any().any():
        return False
    
    # Check cash amounts
    if (df["cash_amount"] < 0).any():
        return False
    
    return True

def validate_aggregates_vs_trades(agg_df: pd.DataFrame, trades_df: pd.DataFrame) -> bool:
    # Check if aggregate OHLC matches trades
    for _, row in agg_df.iterrows():
        trades_in_range = trades_df[
            (trades_df["timestamp"] >= row["timestamp"]) &
            (trades_df["timestamp"] < row["timestamp"] + pd.Timedelta(minutes=1))
        ]
        if not trades_in_range.empty:
            if trades_in_range["price"].min() != row["low"]:
                return False
            if trades_in_range["price"].max() != row["high"]:
                return False
    return True

def validate_quotes_vs_trades(quotes_df: pd.DataFrame, trades_df: pd.DataFrame) -> bool:
    # Check if trade prices are within bid/ask spread
    for _, trade in trades_df.iterrows():
        matching_quote = quotes_df[
            (quotes_df["timestamp"] <= trade["timestamp"]) &
            (quotes_df["timestamp"] >= trade["timestamp"] - pd.Timedelta(seconds=1))
        ]
        if not matching_quote.empty:
            if not (matching_quote["bid_price"].iloc[0] <= trade["price"] <= matching_quote["ask_price"].iloc[0]):
                return False
    return True