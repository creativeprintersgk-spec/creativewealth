import pdfplumber, re, sys

sys.stdout.reconfigure(encoding='utf-8')

with pdfplumber.open('scratch/27-05-2026-contract-notes_VQ6949.pdf', password='CGTPS8217E') as pdf:
    for page in pdf.pages:
        t = page.extract_text(layout=True)
        if t:
            for line in t.split('\n'):
                if 'INE' in line:
                    print(repr(line))
