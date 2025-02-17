import pytest
import pandas as pd
from datetime import datetime
from corporate_actions import CorporateActionsManager 

@pytest.fixture
def split_manager():
    manager = CorporateActionsManager()
    manager.splits = pd.DataFrame({
        'symbol': ['AAPL'],
        'execution_date': [datetime(2020,8,31)],
        'split_from': [1],
        'split_to': [4]
    })
    manager._create_adjustment_maps()
    return manager

@pytest.fixture
def dividend_manager():
    manager = CorporateActionsManager()
    manager.dividends = pd.DataFrame({
        'symbol': ['AAPL'],
        'ex_dividend_date': [datetime(2023,2,10)],
        'cash_amount': [0.23]
    })
    manager._create_adjustment_maps()
    return manager

def test_split_adjustment(split_manager):
    test_data = pd.DataFrame({
        'timestamp': [datetime(2020,8,30), datetime(2020,9,1)],
        'open': [100.0, 125.0],
        'high': [105.0, 130.0],
        'low': [95.0, 120.0],
        'close': [102.0, 128.0],
        'volume': [1e6, 8e5]
    }).set_index('timestamp')


    print("\n=== Test Split Data Before Adjustment ===")
    print(test_data)
    
    adjusted = split_manager.apply_adjustments(test_data, 'AAPL')

    print("\n=== Test Split Data After Adjustment ===")
    print(adjusted)
    
    # Pre-split remains unchanged
    assert adjusted.loc['2020-08-30', 'open'] == 100.0
    # Post-split divided by 4 (split_to/split_from = 4)
    assert adjusted.loc['2020-09-01', 'open'] == 31.25  # 125 / 4
    assert adjusted.loc['2020-09-01', 'volume'] == 3.2e6  # 800k * 4

def test_dividend_adjustment(dividend_manager):
    test_data = pd.DataFrame({
        'timestamp': [datetime(2023,2,9), datetime(2023,2,10)],
        'open': [150.0, 151.0],
        'high': [152.0, 153.0],
        'low': [149.0, 150.5],
        'close': [151.5, 152.5],
        'volume': [1e6, 1e6]
    }).set_index('timestamp')
    
    adjusted = dividend_manager.apply_adjustments(test_data, 'AAPL')
    
    assert adjusted.loc['2023-02-10', 'open'] == 151.0 - 0.23
    assert adjusted.loc['2023-02-09', 'close'] == 151.5  # No adjustment