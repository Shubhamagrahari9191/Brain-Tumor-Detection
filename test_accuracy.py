import os
import numpy as np
from PIL import Image
from tensorflow.keras.models import load_model
from sklearn.metrics import classification_report, confusion_matrix

# Load model
print("Loading model...")
model = load_model('brain_tumor_model.keras')

# Define test dir
test_dir = 'images/testing' if os.path.exists('images/testing') else 'images/Testing'
classes = ['glioma', 'meningioma', 'notumor', 'pituitary']

# Assumed mapping based on alphabetical order
# 0: glioma, 1: meningioma, 2: notumor, 3: pituitary
label_map = {0: 'glioma', 1: 'meningioma', 2: 'notumor', 3: 'pituitary'}

y_true = []
y_pred = []

print("Running predictions on test set...")

for class_name in classes:
    class_dir = os.path.join(test_dir, class_name)
    if not os.path.exists(class_dir):
        print(f"Directory not found: {class_dir}")
        continue
        
    print(f"Processing class: {class_name}")
    files = [f for f in os.listdir(class_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    # Limit to 20 images per class for speed
    for f in files[:20]:
        img_path = os.path.join(class_dir, f)
        try:
            img = Image.open(img_path)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            img = img.resize((299, 299))
            img_array = np.asarray(img)
            img_array = np.expand_dims(img_array, axis=0)
            img_array = img_array / 255.0
            
            pred_probs = model.predict(img_array, verbose=0)
            pred_index = np.argmax(pred_probs[0])
            pred_label = label_map[pred_index]
            
            y_true.append(class_name)
            y_pred.append(pred_label)
        except Exception as e:
            print(f"Error processing {img_path}: {e}")

print("\nClassification Report:")
print(classification_report(y_true, y_pred, labels=classes))

print("\nConfusion Matrix:")
cm = confusion_matrix(y_true, y_pred, labels=classes)
print(cm)

print("\nDetailed Mapping Analysis:")
# Check what each actual class is being predicted as most often
for i, class_name in enumerate(classes):
    # Get indices where actual class is class_name
    indices = [j for j, x in enumerate(y_true) if x == class_name]
    if not indices:
        continue
    
    # Get predictions for these indices
    preds = [y_pred[j] for j in indices]
    
    # Count most common prediction
    from collections import Counter
    counts = Counter(preds)
    most_common = counts.most_common(1)[0]
    
    print(f"Actual '{class_name}' is most often predicted as '{most_common[0]}' ({most_common[1]}/{len(indices)})")
