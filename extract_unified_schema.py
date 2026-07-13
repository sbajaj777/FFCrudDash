import json

with open("GO_Brent_Feedback_Research_v2.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

with open("unified_columns.txt", "w", encoding="utf-8") as out:
    for cell in nb['cells']:
        if cell['cell_type'] == 'code':
            source = ''.join(cell['source'])
            if 'unified = pd.DataFrame({' in source or 'unified = ' in source or 'rename' in source:
                out.write('---\n')
                out.write(source[:1500])
                out.write('\n')
