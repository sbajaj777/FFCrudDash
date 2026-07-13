import sqlite3
import json

db_path = 'data/bars_15min_20260612.db'
conn = sqlite3.connect(db_path)
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
with open('tables.json', 'w') as f:
    json.dump(tables, f)
