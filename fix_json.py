import json

with open("GO_Brent_Feedback_Research_v2.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

for cell in nb["cells"]:
    if "source" in cell:
        # For each line in the source list, replace literal '\\n' with '\n'
        # Wait, if a line is "print('\\n')\\n", the first '\\n' should maybe stay if it was a newline in the print?
        # But wait, in the script I wrote `print('\\nASYMMETRY TEST...')\\n`
        # So I literally put `\\n` everywhere.
        new_source = []
        for line in cell["source"]:
            if line.endswith("\\n"):
                line = line[:-2] + "\n"
            new_source.append(line)
        cell["source"] = new_source

with open("GO_Brent_Feedback_Research_v2.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)
