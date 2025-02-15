import tensorflowjs as tfjs

# Convert Keras model to TF.js format
tfjs.converters.save_keras_model(
    tf.keras.models.load_model('hybrid_model.h5'),
    'tfjs_model',
    quantization_dtype='uint8'
)

print("Model converted to TF.js format")