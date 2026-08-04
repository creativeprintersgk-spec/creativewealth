import pypdf

pdf_path = r"C:\Users\Admin\Desktop\CAS A.pdf"
reader = pypdf.PdfReader(pdf_path)

print("Total pages:", len(reader.pages))
for i, page in enumerate(reader.pages):
    print(f"\n--- Page {i+1} ---")
    text = page.extract_text()
    print(text)
