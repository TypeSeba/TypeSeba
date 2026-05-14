import os
import re

img_dir = r"e:\Bulldog Studio\2026\TypeSeba\Web TypeSeba\public\img"
project_dir = r"e:\Bulldog Studio\2026\TypeSeba\Web TypeSeba\public"

images = [f for f in os.listdir(img_dir) if os.path.isfile(os.path.join(img_dir, f))]

# Files to search in
search_files = []
for root, dirs, files in os.walk(project_dir):
    if "img" in root: continue # skip the img dir itself
    for file in files:
        if file.endswith((".html", ".css", ".js")):
            search_files.append(os.path.join(root, file))

unused = []
used = []

for img in images:
    found = False
    for sf in search_files:
        try:
            with open(sf, 'r', encoding='utf-8') as f:
                content = f.read()
                if img in content:
                    found = True
                    break
        except:
            continue
    if found:
        used.append(img)
    else:
        unused.append(img)

print("--- USED ---")
for u in used:
    print(u)

print("\n--- UNUSED ---")
for u in unused:
    print(u)
