import numpy as np
import tensorflow as tf
from tensorflow.keras.layers import Input, LSTM, Dense, LayerNormalization, Conv1D, GlobalMaxPooling1D
from tensorflow.keras.models import Model
from tensorflow.keras.optimizers import Adam

def create_hybrid_model(input_shape, lstm_units=64, conv_filters=32, dense_units=32):
    inputs = Input(shape=input_shape)
    
    # LSTM Temporal Processing
    x = LSTM(lstm_units, return_sequences=True)(inputs)
    x = LayerNormalization()(x)
    
    # Temporal Convolution Block (Replaces Transformer)
    x = Conv1D(filters=conv_filters, kernel_size=3, padding='same', activation='relu')(x)
    x = LayerNormalization()(x)
    x = Conv1D(filters=conv_filters, kernel_size=3, padding='same', activation='relu')(x)
    x = LayerNormalization()(x)
    
    # Global Pooling
    x = GlobalMaxPooling1D()(x)
    
    # Intermediate dense processing
    x = Dense(dense_units, activation='relu')(x)
    
    # Multi-Task Outputs
    direction = Dense(1, activation='sigmoid', name='direction')(x)
    volatility = Dense(1, activation='relu', name='volatility')(x)
    position = Dense(1, activation='sigmoid', name='position')(x)
    
    model = Model(inputs=inputs, outputs=[direction, volatility, position])
    
    model.compile(optimizer=Adam(0.001),
                  loss={'direction': 'binary_crossentropy',
                        'volatility': 'mse',
                        'position': 'mse'},
                  metrics={'direction': 'accuracy'})
    return model

# Generate dummy data for testing
def generate_dummy_data(samples=1000, timesteps=60, features=6):
    return np.random.randn(samples, timesteps, features).astype(np.float32)

if __name__ == "__main__":
    # Create and test model
    model = create_hybrid_model(input_shape=(60, 6))
    model.summary()
    
    # Test model with dummy data
    X = generate_dummy_data()
    y_dir = np.random.randint(0, 2, 1000)
    y_vol = np.random.rand(1000)
    y_pos = np.random.rand(1000)
    
    model.fit(X, [y_dir, y_vol, y_pos], epochs=2, batch_size=32)
    
    # Save model
    model.save('hybrid_model.h5')
    model.save_weights('hybrid_model.weights.h5')  # Backup weights
    print("Model saved successfully")