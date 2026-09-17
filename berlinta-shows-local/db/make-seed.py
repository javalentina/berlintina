#!/usr/bin/env python3
"""Turn the Supabase dump into an INSERT script for the new Postgres database.

Table order follows the foreign keys. The generated column shows.fts is skipped —
Postgres computes it itself.
"""
import json, sys, os

BACKUP = sys.argv[1]
ORDER = ["artist_accounts", "artist_tokens", "show_submissions", "shows",
         "kb_articles", "blog_posts", "contact_requests"]
GENERATED = {"shows": {"fts"}}

def lit(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"

out = ["begin;"]
for table in ORDER:
    path = os.path.join(BACKUP, table + ".json")
    rows = json.load(open(path)) if os.path.exists(path) else []
    if not rows:
        out.append(f"-- {table}: keine Zeilen")
        continue
    skip = GENERATED.get(table, set())
    cols = [c for c in rows[0].keys() if c not in skip]
    collist = ", ".join('"%s"' % c for c in cols)
    out.append(f"-- {table}: {len(rows)} Zeilen")
    for r in rows:
        vals = ", ".join(lit(r.get(c)) for c in cols)
        out.append(f'insert into {table} ({collist}) values ({vals}) on conflict (id) do nothing;')
out.append("commit;")
print("\n".join(out))
