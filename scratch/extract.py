import pypdf
reader = pypdf.PdfReader("C:/Users/Admin/Desktop/27-05-2026-contract-notes_VQ6949.pdf")
if reader.is_encrypted:
    reader.decrypt("CGTPS8217E")
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"
with open("C:/Users/Admin/Desktop/wealthcore-clean/scratch/pdf_text_decrypted.txt", "w", encoding="utf-8") as f:
    f.write(text)
print("Done")
