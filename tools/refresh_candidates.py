"""Rebuild tools/candidates.json from the season stats CSV. Run on Neal's Mac whenever new stats arrive:

    python3 tools/refresh_candidates.py "/Users/nealt1/Downloads/BatCH26-27-stats (1).csv"

then commit tools/candidates.json. The CSV stays on the Mac (the repo is public). The daily workflow reads only
candidates.json. Standard library only.
"""
import json, os, sys, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from statlib import candidates, banned

if len(sys.argv) != 2:
    sys.exit(__doc__)
C, PP, PTF = candidates(sys.argv[1])
out = {'generated': datetime.date.today().isoformat(), 'points': PP, 'pt_fame': PTF, 'candidates': []}
for k, (short, text, vals, ratio, concept, game, tour) in sorted(C.items()):
    if banned(k) or not vals: continue
    if 'scored' in text: raise SystemExit(f'{k}: say "caught a goal"/"threw an assist", never "scored"')
    out['candidates'].append({'id': k, 'short': short, 'text': text, 'concept': concept, 'game': game, 'tour': tour, 'ratio': ratio, 'values': vals})
json.dump(out, open(os.path.join(HERE, 'candidates.json'), 'w'), indent=1, sort_keys=True)
n = sum(1 for c in out['candidates'] if 10 <= len(c['values']) <= 19)
print(f"wrote tools/candidates.json: {len(out['candidates'])} questions, {n} with 10-19 answers")
