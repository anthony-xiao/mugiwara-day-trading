# Correct import statement
from model_training import create_hybrid_model  # Changed from model-training
import numpy as np

def test_model_creation():
    X_train = np.random.randn(1000, 60, 10)
    model = create_hybrid_model((60, 10))
    assert model.input_shape == (None, 60, 10), "Input shape mismatch"
    print("✓ Model creation test passed!")

if __name__ == "__main__":
    test_model_creation()