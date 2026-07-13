import json

with open("GO_Brent_Feedback_Research_v2.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = "".join(cell['source'])
        if 'plt.show()' in source:
            new_source = source.replace('plt.show()', "import IPython.display; IPython.display.display(plt.gcf()); plt.clf()")
            cell['source'] = [line + "\n" for line in new_source.split("\n")[:-1]] + [new_source.split("\n")[-1]]

with open("GO_Brent_Feedback_Research_v2.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Replaced plt.show() with display(plt.gcf())")
