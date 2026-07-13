import json

with open("GO_Brent_Feedback_Research_v2.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

with open("nb_structure.txt", "w", encoding="utf-8") as out:
    for i, cell in enumerate(nb["cells"]):
        first_line = cell["source"][0].strip() if cell["source"] else ""
        out.write(f"Cell {i} [{cell['cell_type']}]: {first_line[:80]}\n")
