import os

detect_path = r"C:\Users\Admin\AppData\Roaming\Python\Python314\site-packages\casparser\parsers\detect.py"

with open(detect_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """    if "CAMSCASWS" in text:
        return FileType.CAMS
    if "KFINCASWS" in text:
        return FileType.KFINTECH"""

replacement = """    if "CAMSCASWS" in text or "Registrar : CAMS" in text:
        return FileType.CAMS
    if "KFINCASWS" in text or "Registrar : KFIN" in text or "Registrar : KFINTECH" in text:
        return FileType.KFINTECH"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(detect_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Successfully patched detect.py")
else:
    print("Target not found in detect.py! Maybe already patched or format changed.")
