import pdfplumber, re, sys, json

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = sys.argv[1] if len(sys.argv) > 1 else 'scratch/27-05-2026-contract-notes_VQ6949.pdf'
password = sys.argv[2] if len(sys.argv) > 2 else 'CGTPS8217E'

with pdfplumber.open(pdf_path, password=password) as pdf:
    all_text = ""
    for page in pdf.pages:
        t = page.extract_text(layout=True)
        if t:
            all_text += t + "\n"
    
    print("=== ALL LINES WITH INE ===")
    for i, line in enumerate(all_text.split('\n')):
        if 'INE' in line:
            tokens = line.strip().split()
            print(f"LINE {i}: {repr(line.strip())}")
            print(f"  TOKENS ({len(tokens)}): {tokens}")
            print()
