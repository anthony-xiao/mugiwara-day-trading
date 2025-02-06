# risk-management/regime-detector.py
from hmmlearn import hmm

def detect_regime(prices):
    returns = np.diff(np.log(prices)).reshape(-1, 1)
    model = hmm.GaussianHMM(n_components=3, covariance_type="diag")
    model.fit(returns)
    return model.predict(returns)