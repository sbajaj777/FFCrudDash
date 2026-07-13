import json

with open("GO_Brent_Feedback_Research_v2.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        # Add %matplotlib inline to the first code cell
        if "%matplotlib inline\n" not in cell['source']:
            cell['source'].insert(0, "%matplotlib inline\n")
        break

with open("GO_Brent_Feedback_Research_v2.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Injected %matplotlib inline")
