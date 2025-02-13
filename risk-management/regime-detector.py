# risk-management/regime-detector.py
import numpy as np
from hmmlearn import hmm
from sklearn.preprocessing import StandardScaler
import pandas as pd

class MarketRegimeClassifier:
    def __init__(self, n_regimes=3):
        self.scaler = StandardScaler()
        self.model = hmm.GaussianHMM(
            n_components=n_regimes,
            covariance_type="full",
            n_iter=1000
        )
        self.regime_labels = {
            0: "low_volatility",
            1: "normal",
            2: "high_volatility"
        }
    
    def fit(self, features: pd.DataFrame):
        """Train on historical features"""
        scaled = self.scaler.fit_transform(features)
        self.model.fit(scaled)
        return self
    
    def predict_regime(self, window: pd.DataFrame) -> str:
        """Predict current market regime"""
        scaled = self.scaler.transform(window)
        state = self.model.predict(scaled[-60:])[-1]  # Last hour
        return self.regime_labels.get(state, "unknown")
    
    def get_regime_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """Feature engineering for regime detection"""
        return pd.DataFrame({
            'volatility': data['close'].pct_change().rolling(20).std(),
            'volume_zscore': (
                data['volume'] - data['volume'].rolling(20).mean()
            ) / data['volume'].rolling(20).std(),
            'spread': data['high'] - data['low'],
            'vwap_dev': (data['close'] - data['vwap']) / data['vwap']
        }).dropna()