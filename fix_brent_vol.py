import json

with open("GO_Brent_Feedback_Research_v2.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

for cell in nb["cells"]:
    if cell["cell_type"] == "code":
        source = "".join(cell["source"])
        if "derived_cols = ['brent_c1', 'gasoil_c1', 'go_brent_spread', 'brent_vol_21d']" in source:
            new_source = source.replace("derived_cols = ['brent_c1', 'gasoil_c1', 'go_brent_spread', 'brent_vol_21d']", 
                                        "derived_cols = [c for c in ['brent_c1', 'gasoil_c1', 'go_brent_spread', 'brent_vol_21d', 'brent_volatility'] if c in unified.columns]")
            cell["source"] = [line + "\n" for line in new_source.split("\n")[:-1]] + [new_source.split("\n")[-1]]

with open("GO_Brent_Feedback_Research_v2.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Fixed notebook.")
