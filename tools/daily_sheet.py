"""Adds today's Batchillion stat sheet to roster.js. Run by .github/workflows/daily-sheet.yml at midnight Eastern.

What it does, given today's date in America/New_York:
  1. If a sheet already unlocks today, it exits 0 and changes nothing (safe to run more than once).
  2. Otherwise it picks 7 questions from tools/candidates.json that no sheet has used yet, under Neal's rules:
     10-19 valid answers each (aim about 13); every sheet can reach 625+ yards with each name counted once per
     round; 2-3 "star" one-in-a-batchillions (the single fewest is a high-playing-time player, fame 1.10+); no
     player is the one in a batchillion twice on one sheet; no two questions of the same kind; at most one
     question per game and two per tournament. Tiers use tools/sheetlib.py (the same rules as the game).
  3. It appends "Stat sheet <next numeral>" (id stats<N>, unlock today) to window.ROUNDS, hides all but the
     newest 4 live stat sheets (retired: they still score and keep their leaderboards), refreshes
     window.PT_CAP and bumps the asset version in index.html.
If no valid sheet can be made, it exits 2 with the reason and writes nothing.

Usage: python3 tools/daily_sheet.py [--date 2026-11-8] [--dry-run] [--force] [--root DIR]
  --date     pretend today is this date (testing; acts at any hour)
  --force    act at any hour (the workflow passes this on a manual run)
  --dry-run  print the sheet, write nothing
Standard library only.
"""
import argparse, datetime, json, os, random, re, sys
from zoneinfo import ZoneInfo
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import sheetlib as S

AIM, LO, HI, MIN_MAX, LIVE = 13, 10, 19, 625, 4
STAR_FAME = 1.10


def roman(n):
    out = ''
    for v, r in ((1000, 'M'), (900, 'CM'), (500, 'D'), (400, 'CD'), (100, 'C'), (90, 'XC'), (50, 'L'), (40, 'XL'), (10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')):
        while n >= v: out += r; n -= v
    return out


slug = lambda k: re.sub(r'[^a-z0-9]+', '-', k.lower()).strip('-')
HEAD = re.compile(r'^  \{ id: "(stats(\d+))", title: "([^"]+)", (.*?)unlock: "([^"]+)", prompts: \[', re.M)
PROMPT = re.compile(r'^      \{ id: "([^"]+)", short: "([^"]*)", text: "([^"]*)"', re.M)


def sheets_in(js):
    return [{'id': m.group(1), 'n': int(m.group(2)), 'title': m.group(3), 'retired': 'retired: true' in m.group(4), 'unlock': m.group(5)} for m in HEAD.finditer(js)]


PER_PLAYER = ('to', 'from', 'goalfrom', 'tour-to', 'tour-from', 'oline-from', 'oline-to', 'dline-from', 'dline-to')


def kind(c):
    """Two questions of the same kind about the same game, tournament or season stat only differ by a threshold
    ("3+ points in the Duke scrim" vs "5+ points in the Duke scrim"), so once one is used the rest count as used."""
    return (base(c), c['id'] if c['concept'] in PER_PLAYER else c['game'] or c['tour'] or '')


def base(c):
    """"caught the disc" and "caught the disc 3+ times" are the same kind of question."""
    return c['concept'][:-1] if c['concept'].endswith('N') else c['concept']


class NoSheet(Exception):
    pass


def build(day, js, pool):
    """Returns (sheet dict, block text) or raises NoSheet with the reason."""
    used_ids = {m.group(1) for m in PROMPT.finditer(js)}
    used_text = {m.group(3) for m in PROMPT.finditer(js)}
    used_kinds = {kind(c) for c in pool['candidates'] if slug(c['id']) in used_ids or c['text'] in used_text}
    pp, ptf = pool['points'], pool['pt_fame']
    cands = []
    for c in pool['candidates']:
        n = len(c['values'])
        if not (LO <= n <= HI) or kind(c) in used_kinds or 'scored' in c['text']: continue
        tm, ob = S.tier_question(c['values'], c['ratio'], pp, ptf)
        kr = [p for p, t in tm.items() if t == 'krillion']
        best = max(S.TP[t] for t in tm.values())
        cands.append({**c, 'tm': tm, 'ob': ob, 'n': n, 'kr': kr[0] if kr else None, 'star': bool(kr) and ptf.get(kr[0], 0) >= STAR_FAME, 'best': best})
    stars = [c for c in cands if c['star']]
    others = [c for c in cands if not c['star'] and c['best'] >= 85]
    if len(stars) < 2:
        raise NoSheet(f'no sheet for {day}: only {len(stars)} unused star questions left (need 2). Run tools/refresh_candidates.py with new stats.')
    rng = random.Random(day)
    found = []
    for attempt in range(4000):
        k = 2 if attempt < 3000 else 3   # spend stars slowly: 2 a day unless only 3 makes a sheet
        key = lambda c: abs(c['n'] - AIM) / 2 + (0 if c['best'] == 100 else 3) + rng.random() * 6   # near 13 answers, a single fewest, some variety
        pick = []
        def fits(c):
            if any(base(c) == base(p) for p in pick): return False
            if c['game'] and any(c['game'] == p['game'] for p in pick): return False
            if c['tour'] and sum(1 for p in pick if p['tour'] == c['tour']) >= 2: return False
            if c['kr'] and any(c['kr'] == p['kr'] for p in pick): return False
            return True
        for c in sorted(stars, key=key):
            if len(pick) == k: break
            if fits(c): pick.append(c)
        if len(pick) < 2: continue
        for c in sorted(others, key=key):
            if len(pick) == 7: break
            if fits(c): pick.append(c)
        if len(pick) < 7 or not (2 <= sum(p['star'] for p in pick) <= 3): continue
        mx = S.distinct_max([p['tm'] for p in pick])
        if mx < MIN_MAX: continue
        found.append((sum(abs(p['n'] - AIM) for p in pick) + rng.random(), mx, pick))
        if len(found) >= 40: break
    if not found:
        raise NoSheet(f'no sheet for {day}: {len(cands)} unused questions with {LO}-{HI} answers ({len(stars)} star) could not make a sheet '
                         f'that reaches {MIN_MAX} yards under the rules. Run tools/refresh_candidates.py with new stats.')
    _, mx, pick = min(found, key=lambda f: f[0])
    rng.shuffle(pick)
    last = max([s['n'] for s in sheets_in(js)] or [8])
    n = last + 1
    y, m, d = (int(x) for x in day.split('-'))
    unlock = f'{y}-{m}-{d}'
    sheet = {'id': f'stats{n}', 'title': f'Stat sheet {roman(n)}', 'unlock': unlock, 'max': mx, 'prompts': pick}
    lines = [S.prompt_js(slug(p['id']), p['short'], p['text'], p['tm'], p['ob']) for p in pick]
    block = f'  {{ id: "{sheet["id"]}", title: "{sheet["title"]}", unlock: "{unlock}", prompts: [\n' + ',\n'.join(lines) + ',\n    ] },'
    return sheet, block


def apply(js, sheet, block, pool):
    end = js.index('\n];', js.index('window.ROUNDS = ['))
    js = js[:end] + '\n' + block + js[end:]
    live = sorted((s for s in sheets_in(js) if not s['retired'] and s['n'] >= 5), key=lambda s: s['n'])
    for s in live[:-LIVE]:   # hide all but the newest 4 live stat sheets; they keep scoring and leaderboards
        js = re.sub(r'(  \{ id: "' + s['id'] + r'", title: "[^"]+", )', r'\1retired: true, ', js, count=1)
    caps = {p: S.cap_for(p, pool['pt_fame']) for p in sorted(pool['pt_fame'])}
    line = '// Playing-time fame cap for stat answers (pt_fame.py): how obvious a stat answer can be.\nwindow.PT_CAP = ' + json.dumps(caps) + ';'
    js = re.sub(r'// Playing-time fame cap.*?\nwindow\.PT_CAP = .*?;', lambda m: line, js, flags=re.S)
    return js


def bump(html):
    v = int(re.search(r'name="bh-version" content="(\d+)"', html).group(1))
    html = html.replace(f'content="{v}"', f'content="{v + 1}"').replace(f'?v={v}"', f'?v={v + 1}"')
    return html, v + 1


def main():
    ap = argparse.ArgumentParser(description='Add today\'s Batchillion stat sheet.')
    ap.add_argument('--date'); ap.add_argument('--dry-run', action='store_true'); ap.add_argument('--force', action='store_true')
    ap.add_argument('--root', default=os.path.dirname(HERE))
    a = ap.parse_args()
    now = datetime.datetime.now(ZoneInfo('America/New_York'))
    if a.date:
        day = a.date
    else:
        if not a.force and now.hour > 3:
            print(f'not midnight in Eastern time ({now:%H:%M}); nothing to do'); return 0
        day = now.date().isoformat()
    y, m, d = (int(x) for x in day.split('-'))
    unlock = f'{y}-{m}-{d}'
    rp, ip = os.path.join(a.root, 'roster.js'), os.path.join(a.root, 'index.html')
    js = open(rp).read()
    if any(s['unlock'] == unlock and s['n'] >= 9 for s in sheets_in(js)):
        print(f'a sheet already unlocks {unlock}; nothing to do'); return 0
    pool = json.load(open(os.path.join(HERE, 'candidates.json')))
    try:
        sheet, block = build(day, js, pool)
    except NoSheet as e:
        print(f'ERROR: {e}', file=sys.stderr); return 2
    print(f"{sheet['title']} ({sheet['id']}), unlocks {sheet['unlock']}, max {sheet['max']} yards")
    for p in sheet['prompts']:
        print(f"  {p['n']:2} answers | {p['short']} | one in a batchillion: {p['kr'] or '-'}{' (star)' if p['star'] else ''}")
    if a.dry_run: return 0
    js = apply(js, sheet, block, pool)
    html, v = bump(open(ip).read())
    open(rp, 'w').write(js); open(ip, 'w').write(html)
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a') as f: f.write(f"sheet={sheet['id']}\nday={unlock}\n")
    print(f'wrote roster.js and index.html (v{v})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
