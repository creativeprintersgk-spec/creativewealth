import re

with open('scratch/wc_full_ocr_text.txt', 'r', encoding='utf-8') as f:
    wc_text = f.read()

with open('scratch/mp_saahil_report.txt', 'r', encoding='utf-8') as f:
    mp_text = f.read()

print('=== WEALTHCORE REPORT TOTALS SEARCH ===')
for line in wc_text.split('\n'):
    if 'Total' in line or 'STCG' in line or 'LTCG' in line or 'Grand' in line or 'Short' in line or 'Long' in line:
        print(line)

print('\n=== MPROFIT REPORT TOTALS SEARCH ===')
for line in mp_text.split('\n'):
    if 'Total' in line or 'STCG' in line or 'LTCG' in line or 'Grand' in line or 'Short' in line or 'Long' in line:
        print(line)
