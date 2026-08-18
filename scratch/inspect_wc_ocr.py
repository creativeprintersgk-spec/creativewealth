with open('scratch/wc_full_ocr_text.txt', 'r', encoding='utf-8') as f:
    text = f.read()

lines = [line.strip() for line in text.split('\n') if line.strip()]
print(f'Total lines in WealthCore OCR text: {len(lines)}')

# Print first 50 lines and last 50 lines
print('\n--- FIRST 40 LINES ---')
print('\n'.join(lines[:40]))

print('\n--- LAST 40 LINES ---')
print('\n'.join(lines[-40:]))
