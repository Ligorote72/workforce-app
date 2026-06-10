import os
from PIL import Image

public_dir = r"c:\Users\lenovo\.gemini\antigravity\playground\workforce-app\public"
icon_path = os.path.join(public_dir, "icon.png")

if not os.path.exists(icon_path):
    print("Icon not found at", icon_path)
    exit(1)

img = Image.open(icon_path)

# Resize to 192x192
img_192 = img.resize((192, 192), Image.Resampling.LANCZOS)
img_192.save(os.path.join(public_dir, "icon-192.png"))

# Resize to 512x512
img_512 = img.resize((512, 512), Image.Resampling.LANCZOS)
img_512.save(os.path.join(public_dir, "icon-512.png"))

print("Icons resized successfully.")
