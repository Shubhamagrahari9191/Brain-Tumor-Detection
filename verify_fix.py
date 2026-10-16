import os
import random
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from tensorflow.keras.models import load_model

# Load the model
model = load_model('brain_tumor_model.keras')

# Define the predict function with fixed labels
def predict(img_path):
    # Explicitly define labels in the correct order (0, 1, 2, 3)
    labels = ['glioma', 'meningioma', 'notumor', 'pituitary']
    
    img = Image.open(img_path)
    # Ensure image is RGB (3 channels)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    resized_img = img.resize((299, 299))
    img_array = np.asarray(resized_img)
    img_array = np.expand_dims(img_array, axis=0)
    img_array = img_array / 255
    predictions = model.predict(img_array)
    probs = list(predictions[0])
    
    predicted_class = labels[np.argmax(probs)]
    print(f"Predicted Class: {predicted_class}")
    print(f"Probabilities: {dict(zip(labels, probs))}")
    return predicted_class

# Random test logic
test_dir = 'images/testing' if os.path.exists('images/testing') else 'images/Testing'
all_images = []
for root, dirs, files in os.walk(test_dir):
    for file in files:
        if file.endswith('.jpg'):
            all_images.append(os.path.join(root, file))

if all_images:
    random_image_path = random.choice(all_images)
    actual_class = os.path.basename(os.path.dirname(random_image_path))
    print(f"Testing with image: {random_image_path}")
    print(f"Actual Class: {actual_class}")
    predict(random_image_path)
else:
    print("No images found in testing directory.")
