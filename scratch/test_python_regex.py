import re

text = """INE733E01010 NTPC 35 402.1500 0.0000 402.1500 14075.25 0 0.0000 0.0000 0.0000 0.00 35 −14075.25"""

match = re.search(r"(INE[A-Z0-9]{9})\s+(.*?)\s+(\d+)\s+([\d\.]+)\s+[\d\.]+\s+[\d\.]+\s+([\d\.]+)\s+(\d+)\s+([\d\.]+)\s+[\d\.]+\s+[\d\.]+\s+([\d\.]+)", text)
if match:
    print("Matched!")
else:
    print("No match!")
