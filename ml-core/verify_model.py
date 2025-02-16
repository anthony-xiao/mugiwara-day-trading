import tensorflow as tf
import numpy as np
from model_training  import create_hybrid_model  # Import your model creation function

def test_model(model_path, weights_path=None):
    """
    Tests loading and predicting with a saved model.
    Supports both .keras and .h5 formats.
    """
    try:
        print(f"Testing model at: {model_path}")
        
        # Attempt to load the model directly
        try:
            model = tf.keras.models.load_model(model_path)
            print("✅ Model loaded directly!")
        except Exception as e:
            print(f"Direct load failed: {str(e)}")
            if weights_path:
                print("Attempting to load architecture + weights separately...")
                model = create_hybrid_model(input_shape=(60, 6))
                model.load_weights(weights_path)
                print("✅ Model loaded via architecture + weights!")
            else:
                raise ValueError("Weights path required for fallback loading.")
        
        # Verify model architecture
        print("\nModel Summary:")
        model.summary()
        
        # Test prediction
        test_input = np.random.randn(1, 60, 6).astype(np.float32)
        outputs = model.predict(test_input)
        
        print("\n✅ Prediction successful!")
        print(f"Direction: {outputs[0][0][0]:.2f}")
        print(f"Volatility: {outputs[1][0][0]:.2f}")
        print(f"Position: {outputs[2][0][0]:.2f}")
        
    except Exception as e:
        print(f"❌ Error testing model: {str(e)}")

def verify_all_formats():
    """
    Tests all supported model formats.
    """
    print("=== Testing .keras format ===")
    test_model('hybrid_model.keras')
    
    print("\n=== Testing .h5 format ===")
    test_model('hybrid_model.h5')
    
    print("\n=== Testing weights-only format ===")
    test_model(None, weights_path='hybrid_model.weights.h5')

if __name__ == "__main__":
    verify_all_formats()