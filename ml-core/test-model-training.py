# ml-core/test-model-training.py
from model_training import create_hybrid_model
import numpy as np

X_train = np.random.randn(1000, 60, 10)  # 60 timesteps, 10 features
model = create_hybrid_model((60, 10))
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy')
print(model.summary())

# Expected output: Model architecture with LSTM+Transformer layers