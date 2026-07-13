import sqlite3
db_path = 'data/bars_15min_20260612.db'
conn = sqlite3.connect(db_path)
tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
print('Tables in DB:')
for t in sorted(tables):
    print(' ', t)
conn.close()
