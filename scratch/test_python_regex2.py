import re

with open("scratch/extracted_cn_text.txt", "r", encoding="utf-8") as f:
    text = f.read()

trades = []
for line in text.split("\n"):
    line = line.strip()
    if "INE" in line and len(line.split()) >= 10:
        normalized_line = re.sub(r'\s+', ' ', line)
        # Use [\d\.,]+ instead of [\d\.]+
        match = re.search(r"(INE[A-Z0-9]{9})\s+(.*?)\s+([\d,]+)\s+([\d\.,]+)\s+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)\s+([\d,]+)\s+([\d\.,]+)\s+[\d\.,]+\s+[\d\.,]+\s+([\d\.,]+)", normalized_line)
        if match:
            print("MATCHED:", match.groups())
            trades.append(match.groups())
        else:
            print("FAILED TO MATCH")
            
print("Total trades matched:", len(trades))
