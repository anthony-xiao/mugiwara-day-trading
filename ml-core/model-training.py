# ml-core/model-training.py
import tensorflow as tf
from tensorflow.keras.layers import LSTM, MultiHeadAttention, Dense

def create_hybrid_model(input_shape):
    inputs = tf.keras.Input(shape=input_shape)
    
    # LSTM Temporal Processing
    lstm_out = LSTM(64, return_sequences=True)(inputs)
    lstm_out = LSTM(32)(lstm_out)
    
    # Transformer Attention
    attn_out = MultiHeadAttention(num_heads=4, key_dim=8)(inputs, inputs)
    attn_out = tf.keras.layers.GlobalAveragePooling1D()(attn_out)
    
    combined = tf.keras.layers.concatenate([lstm_out, attn_out])
    
    # Multi-Task Output
    direction = Dense(2, activation='softmax', name='direction')(combined)
    volatility = Dense(1, activation='relu', name='volatility')(combined)
    position = Dense(1, activation='sigmoid', name='position')(combined)
    
    return tf.keras.Model(inputs, [direction, volatility, position])