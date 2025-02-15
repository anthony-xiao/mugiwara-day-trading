import tensorflow as tf
import numpy as np

def test_model():
    try:
        # Load model with custom objects if needed
        model = tf.keras.models.load_model('hybrid_model.keras')
        
        # Create test input
        test_input = np.random.randn(1, 60, 6).astype(np.float32)
        
        # Get predictions
        outputs = model.predict(test_input)
        
        print("Model loaded successfully!")
        print(f"Direction: {outputs[0][0][0]:.2f}")
        print(f"Volatility: {outputs[1][0][0]:.2f}")
        print(f"Position: {outputs[2][0][0]:.2f}")
        
    except Exception as e:
        print(f"Error loading model: {str(e)}")
        print("Trying alternative loading method...")
        load_with_custom_objects()

def load_with_custom_objects():
    # Rebuild model architecture
    model = create_hybrid_model(input_shape=(60, 6))
    
    # Load weights
    model.load_weights('hybrid_model.weights.h5')
    
    # Test prediction
    test_input = np.random.randn(1, 60, 6)
    outputs = model.predict(test_input)
    
    print("Model loaded via custom objects!")
    print(f"Direction: {outputs[0][0][0]:.2f}")
    print(f"Volatility: {outputs[1][0][0]:.2f}")
    print(f"Position: {outputs[2][0][0]:.2f}")

if __name__ == "__main__":
    test_model()