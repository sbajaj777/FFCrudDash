import json

with open("GO_Brent_Feedback_Research_v2.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

with open("check_inline.txt", "w", encoding="utf-8") as out:
    for cell in nb['cells']:
        if cell['cell_type'] == 'code':
            source = "".join(cell['source'])
            if "matplotlib" in source.lower():
                out.write(source[:500] + "\n")
