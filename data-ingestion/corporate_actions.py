import os
import requests
import pandas as pd
from datetime import datetime
from typing import Dict, List
from historical_data_fetcher import (
    POLYGON_API_KEY,
    BASE_URL,
    fetch_paginated_data,
    initialize_trading_days,
    logging
)

class CorporateActionsManager:
    def __init__(self):
        self.splits = pd.DataFrame(columns=['symbol', 'execution_date', 'split_from', 'split_to'])
        self.dividends = pd.DataFrame(columns=['symbol', 'ex_dividend_date', 'cash_amount'])
        self.loaded_symbols = set()
        
    def fetch_corporate_actions(self, symbols: List[str], start_date: str, end_date: str):
        """Fetch splits and dividends for multiple symbols"""
        self._fetch_splits(symbols, start_date, end_date)
        self._fetch_dividends(symbols, start_date, end_date)
        self._create_adjustment_maps()
        
    def _fetch_splits(self, symbols: List[str], start_date: str, end_date: str):
        """Fetch stock splits using Polygon v3 API"""
        url = f"{BASE_URL}/v3/reference/splits"
        params = {
            'ticker.in': ','.join(symbols),
            'execution_date.gte': start_date,
            'execution_date.lte': end_date,
            'limit': 1000
        }
        
        results = fetch_paginated_data(url, params)
        if results:
            splits = pd.DataFrame(results)[['ticker', 'execution_date', 'split_from', 'split_to']]
            splits.rename(columns={'ticker': 'symbol'}, inplace=True)
            self.splits = pd.concat([self.splits, splits], ignore_index=True)
            
    def _fetch_dividends(self, symbols: List[str], start_date: str, end_date: str):
        """Fetch dividends using Polygon v3 API"""
        url = f"{BASE_URL}/v3/reference/dividends"
        params = {
            'ticker.in': ','.join(symbols),
            'ex_dividend_date.gte': start_date,
            'ex_dividend_date.lte': end_date,
            'limit': 1000
        }
        
        results = fetch_paginated_data(url, params)
        if results:
            divs = pd.DataFrame(results)[['ticker', 'ex_dividend_date', 'cash_amount']]
            divs.rename(columns={'ticker': 'symbol'}, inplace=True)
            self.dividends = pd.concat([self.dividends, divs], ignore_index=True)
            
    def _create_adjustment_maps(self):
        """Create fast lookup structures for adjustments"""
        # Convert to datetime
        self.splits['execution_date'] = pd.to_datetime(self.splits['execution_date'])
        self.dividends['ex_dividend_date'] = pd.to_datetime(self.dividends['ex_dividend_date'])
        
        # Create split ratios
        self.splits['split_ratio'] = self.splits['split_to'] / self.splits['split_from']  # Reverse the ratio

        
        # Group by symbol
        self.split_map = self.splits.groupby('symbol')[['execution_date', 'split_ratio']] \
        .apply(lambda x: x.set_index('execution_date')['split_ratio'].to_dict()) \
        .to_dict()

        self.dividend_map = self.dividends.groupby('symbol')[['ex_dividend_date', 'cash_amount']] \
        .apply(lambda x: x.set_index('ex_dividend_date')['cash_amount'].to_dict()) \
        .to_dict()

    def apply_adjustments(self, data_window: pd.DataFrame, symbol: str) -> pd.DataFrame:
        """Adjust historical data for corporate actions"""
        logger = logging.getLogger(__name__)
        if symbol not in self.split_map and symbol not in self.dividend_map:
            logger.debug(f"No corporate actions found for {symbol}")
            return data_window
            
        logger.info(f"Applying corporate actions to {symbol} data")
        logger.debug(f"Original data:\n{data_window.head()}")

        # Make copy to avoid modifying original data
        adjusted_data = data_window.copy()
        
        # Apply splits
        if symbol in self.split_map:
            logger.info(f"Found {len(self.split_map[symbol])} splits for {symbol}")
            for dt, ratio in self.split_map[symbol].items():
                mask = adjusted_data.index >= dt
                adjusted_data.loc[mask, ['open', 'high', 'low', 'close']] /= ratio
                adjusted_data.loc[mask, 'volume'] *= ratio
                logger.debug(f"Post-split sample:\n{adjusted_data[mask].head(1)}")

        # Apply dividends 
        if symbol in self.dividend_map:
            logger.info(f"Found {len(self.dividend_map[symbol])} dividends for {symbol}")
            for dt, amount in self.dividend_map[symbol].items():
                mask = adjusted_data.index >= dt
                adjusted_data.loc[mask, ['open', 'high', 'low', 'close']] -= amount
                logger.debug(f"Post-dividend sample:\n{adjusted_data[mask].head(1)}")

        logger.debug(f"Adjusted data:\n{adjusted_data.tail()}")
        return adjusted_data

# Singleton instance for reuse
corporate_actions_manager = CorporateActionsManager()