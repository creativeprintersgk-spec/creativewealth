import easyocr
import os

reader = easyocr.Reader(['en'])

for p in [16, 25, 26]:
    img_path = f'scratch/wc_page_{p}.png'
    if os.path.exists(img_path):
        print(f'\n=== EASYOCR WEALTHCORE REPORT PAGE {p} ===')
        results = reader.readtext(img_path, detail=0)
        for line in results:
            print(line)
