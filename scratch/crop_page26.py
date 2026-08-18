from PIL import Image
import os

img26 = Image.open('scratch/wc_page_26.png')
print('Page 26 image size:', img26.size)

# Crop bottom half of Page 26
w, h = img26.size
crop_bottom = img26.crop((0, int(h * 0.4), w, h))
crop_bottom.save('scratch/wc_page_26_bottom.png')

print('Saved scratch/wc_page_26_bottom.png')
