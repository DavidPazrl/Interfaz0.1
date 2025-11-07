import sys
import json
import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow import keras

# Suprimir mensajes de TensorFlow
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
tf.get_logger().setLevel('ERROR')

# Configuracion principal del modelo

MODEL_PATH = 'models/modelo0.1.h5'
CLASSES = {0: 'Camisa', 1: 'Polo Azul'}
COMPLIANT_CLASSES = [0, 1]
MIN_CONFIDENCE = 0.60
INPUT_SIZE = (250, 250)

# Funciones auxiliares 

def exit_with_error(msg):
    print(json.dumps({
        'error': msg,
        'isCompliant': False,
        'confidence': 0.0,
        'uniform_type': 'Error'
    }))
    sys.exit(1)

def load_model():
    try:
        model = keras.models.load_model(MODEL_PATH, compile=False)
        model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
        return model
    except Exception as e:
        exit_with_error(f'Error al cargar modelo: {str(e)}')

def preprocess_image(image_path):
    try:
        img = cv2.imread(image_path)
        if img is None:
            exit_with_error(f'No se pudo leer la imagen: {image_path}')
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img = cv2.resize(img, (224, 224)) 
        img = img.astype(np.float32) / 255.0
        img = np.expand_dims(img, axis=0) 
        return img
    except Exception as e:
        exit_with_error(f'Error al procesar imagen: {str(e)}')

def predict(model, image):
    try:
        preds = model.predict(image, verbose=0)
        class_idx = int(np.argmax(preds[0]))
        confidence = float(preds[0][class_idx])
        return class_idx, confidence
    except Exception as e:
        exit_with_error(f'Error en prediccion: {str(e)}')

# Funciones principal

def main():
    if len(sys.argv) < 2:
        exit_with_error('No se proporciono ruta de imagen')

    image_path = sys.argv[1]
    model = load_model()
    processed_image = preprocess_image(image_path)
    class_idx, confidence = predict(model, processed_image)

    uniform_type = CLASSES.get(class_idx, 'Desconocido')
    is_compliant = class_idx in COMPLIANT_CLASSES

    result = {
        'isCompliant': is_compliant,
        'confidence': round(confidence, 4),
        'uniform_type': uniform_type,
        'class_id': class_idx
    }

    print(json.dumps(result))
    sys.stdout.flush()

if __name__ == '__main__':
    main()
