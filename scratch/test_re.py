import re

text = """
TRADE DATE Sep 29 2025
Securities Transaction Tax (Rs.) 184.00 0.00 184.00
CGST 4 Amount (Rs.) 0.69 0.00 0.69
SGST 4 Amount (Rs.) 0.69 0.00 0.69
Taxable Value of Supply (Exchange Transaction Charges) (Rs.) 7.36 0.00 7.36
Taxable Value of Supply (SEBI Turnover Fees) (Rs.) 0.25 0.00 0.25
TAXABLE VALUE OF SUPPLY (IPFT CONTRIBUTION) 0.25 0.00 0.00 0.25
"""

def get_last(pat):
    m = re.findall(pat + r'.*?([\d,]+\.\d{2})\b', text, re.I)
    return float(m[-1].replace(',', '')) if m else 0.0

print('STT:', get_last(r'Securities Transaction Tax'))
print('CGST:', get_last(r'CGST.*?Amount'))
print('SGST:', get_last(r'SGST.*?Amount'))
print('Exc:', get_last(r'Exchange Transaction Charges'))
print('SEBI:', get_last(r'SEBI Turnover Fees'))
print('IPFT:', get_last(r'IPFT CONTRIBUTION'))

m = re.search(r'Trade\s+Date\s*[:\-]?\s*([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})', text, re.I)
print('Date:', f'{m.group(3)}-{m.group(1)}-{m.group(2)}' if m else 'None')
