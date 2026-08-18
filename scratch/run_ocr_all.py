import subprocess
import os

ocr_script = os.path.abspath('scratch/do_ocr.ps1')
output_file = os.path.abspath('scratch/wc_full_ocr_text.txt')

if os.path.exists(output_file):
    os.remove(output_file)

print('Starting OCR processing for 26 pages...')
with open(output_file, 'w', encoding='utf-8') as out:
    for i in range(1, 27):
        img_path = os.path.abspath(f'scratch/wc_page_{i}.png')
        if not os.path.exists(img_path):
            continue
        print(f'Processing Page {i}/26...')
        res = subprocess.run(['powershell', '-ExecutionPolicy', 'Bypass', '-File', ocr_script, '-ImagePath', img_path], capture_output=True, text=True)
        out.write(f'=== PAGE {i} ===\n')
        out.write(res.stdout + '\n\n')

print('OCR completed! Saved to scratch/wc_full_ocr_text.txt')
