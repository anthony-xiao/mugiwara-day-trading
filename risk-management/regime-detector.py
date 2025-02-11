# risk-management/regime-detector.py
import numpy as np
from hmmlearn import hmm
from sklearn.preprocessing import StandardScaler

class MarketRegimeDetector:
    def __init__(self, n_regimes=3):
        self.model = hmm.GaussianHMM(
            n_components=n_regimes,
            covariance_type="diag",
            n_iter=100
        )
        self.scaler = StandardScaler()
    
    def detect_regimes(self, features):
        # Features: [volatility, volume, returns, spread]
        scaled = self.scaler.fit_transform(features)
        self.model.fit(scaled)
        return self.model.predict(scaled)
    
    def current_regime(self, window):
        return self.detect_regimes(window)[-1]