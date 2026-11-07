"""Batchillion stat-question library: reads the BatCH season stats CSV and builds every candidate stat-sheet
question (per game, per tournament, passer/receiver links, line splits, score situations, season ratios and
counts). Standard library only. Used by refresh_candidates.py on Neal's Mac; the CSV itself is never committed.

A candidate is (short, text, {player: value}, is_ratio, concept, game, tour). Ratio questions are ranked with
points played (sheetlib.prior); everything else ranks by the raw value (more = more obvious).
Keys of questions already used on sheets V-VIII are kept exactly as they were (stat_lib4), so they count as used.
"""
import csv, collections

g = lambda x, k: (x.get(k) or '').strip()
ok = lambda n: bool(n) and n != 'Anonymous'
MAP = {'Aashay': 'Aashay Rathi', 'Andrew C': 'Andrew Carneiro', 'Ben H': 'Ben Horton', 'Carson': 'Carson Jewell', 'Centurio': 'Centurion',
       'Dylan': 'Dylan Edwards', 'Eli C': 'Eli Card', 'Ethan B': 'Ethan Berson', 'Jack': 'Jack Herring', 'Luke S': 'Luke Sellers', 'Neal P': 'Neal',
       'Noah G': 'Noah Goldblatt', 'Matthew': 'Matthew Bain', 'Michael': 'Michael Sun', 'Noah N': 'Noah Biggers'}
full = lambda n: MAP.get(n, n)
on = lambda o: 'App State' if o in ('App st', 'App St', 'App') else o
SLUG = lambda s: ''.join(c for c in s.lower() if c.isalnum())
MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
# Kinds that are too basic for a daily sheet (Neal, 11/7): played at a tournament, played in a game with no
# threshold, threw an assist / caught a goal season-wide, season "played N points" filler.
BANNED = {'tp-Bankrun', 'tp-Barebones', 'tp-Feasterns', 'ast1', 'usc-played', 'pts-season'}
BANNED_PREFIX = ('g-',)


def banned(key):
    return key in BANNED or key.startswith(BANNED_PREFIX)


def load(path):
    rows = list(csv.DictReader(open(path, encoding='utf-8-sig')))
    S = collections.defaultdict(collections.Counter)
    pts = collections.defaultdict(set)
    scored = set()
    pkey = lambda x: (g(x, 'Tournamemnt'), g(x, 'Opponent'), g(x, 'Our Score - End of Point'), g(x, 'Their Score - End of Point'), g(x, 'Line'))
    for x in rows:
        k = pkey(x)
        for c in x:
            if c and c.startswith('Player ') and ok(g(x, c)): pts[g(x, c)].add(k)
        a, e, pa, rc, df = g(x, 'Action'), g(x, 'Event Type'), g(x, 'Passer'), g(x, 'Receiver'), g(x, 'Defender')
        if e == 'Offense':
            if a in ('Catch', 'Goal'):
                if ok(pa): S[pa]['comp'] += 1
                if ok(rc): S[rc]['rec'] += 1
            if a == 'Goal':
                scored.add(k)
                if ok(pa): S[pa]['ast'] += 1
                if ok(rc): S[rc]['goal'] += 1
            if a in ('Throwaway', 'Stall') and ok(pa): S[pa]['ta'] += 1
            if a == 'Drop' and ok(rc): S[rc]['drop'] += 1
        else:
            if a == 'D' and ok(df): S[df]['d'] += 1
            if a in ('Pull', 'PullOb') and ok(df): S[df]['pull'] += 1
    for n, ks in pts.items():
        S[n]['pts'] = len(ks)
        S[n]['o'] = sum(1 for k in ks if k[4] == 'O'); S[n]['dp'] = sum(1 for k in ks if k[4] == 'D')
    return rows, S


def pt_fame(rows):
    """For every game a player played: their points / the average points of everyone who played that game,
    averaged over their games. 1.0 = an average share of playing time."""
    pts = collections.defaultdict(lambda: collections.defaultdict(set))
    for x in rows:
        game = (g(x, 'Tournamemnt'), g(x, 'Opponent'), g(x, 'Date/Time')[:10])
        pt = (g(x, 'Our Score - End of Point'), g(x, 'Their Score - End of Point'), g(x, 'Line'))
        for k in x:
            if k and k.startswith('Player ') and ok(g(x, k)): pts[game][g(x, k)].add(pt)
    share = collections.defaultdict(list)
    for pl in pts.values():
        avg = sum(len(v) for v in pl.values()) / len(pl)
        for n, v in pl.items(): share[n].append(len(v) / avg)
    return {full(n): round(sum(v) / len(v), 3) for n, v in share.items()}


def candidates(path):
    rows, S = load(path)
    s = lambda n, k: S[n].get(k, 0)
    N = [n for n in S if ok(n)]
    R = lambda v: round(v, 3)
    thr = lambda n: s(n, 'comp') + s(n, 'ta')
    E = lambda x: (g(x, 'Event Type'), g(x, 'Action'))
    gk = lambda x: (g(x, 'Tournamemnt'), on(g(x, 'Opponent')))
    pkey = lambda x: (g(x, 'Tournamemnt'), on(g(x, 'Opponent')), g(x, 'Date/Time')[:10], g(x, 'Our Score - End of Point'), g(x, 'Their Score - End of Point'))
    lineup = lambda x: [g(x, c) for c in x if c and c.startswith('Player ') and ok(g(x, c))]
    catch = lambda x: E(x) in (('Offense', 'Catch'), ('Offense', 'Goal'))
    goal = lambda x: E(x) == ('Offense', 'Goal')
    touch = lambda x: ([g(x, 'Receiver')] if catch(x) else []) + ([g(x, 'Passer')] if E(x)[0] == 'Offense' and E(x)[1] in ('Catch', 'Goal', 'Throwaway') else [])
    C = {}

    def add(k, short, text, d, ratio, concept, game='', tour=''):
        d = {full(n): v for n, v in d.items() if ok(n) and v}
        C[k] = (short, text, d, ratio, concept, game, tour)

    # game labels from the data: "the UNCCX game at Bankrun (Sept 20)"; the Duke scrim is "the Duke scrim (Nov 5)"
    dates = collections.defaultdict(set)
    for x in rows: dates[gk(x)].add(g(x, 'Date/Time')[:10])
    def label(key):
        t, o = key
        ds = sorted(dates[key]); m = [int(d[5:7]) for d in ds]; dd = [int(d[8:10]) for d in ds]
        when = f'{MON[m[0] - 1]} {dd[0]}' if len(ds) == 1 else f'{MON[m[0] - 1]} {dd[0]}-{dd[-1]}'
        if t == 'Scrim': return f'the {o} scrim ({when})'
        o2 = 'William & Mary' if o == 'W&M' else o
        return f'the {o2} game{"s" if len(ds) > 1 else ""} at {t} ({when})'
    GAMES = {k: label(k) for k in dates}
    TOURS = {'Bankrun': 'the Bankrun tournament (Sept 19-20)', 'Barebones': 'the Barebones tournament (Oct 3-4)', 'Feasterns': 'the Feasterns tournament (Oct 16-18)'}

    gp = collections.defaultdict(lambda: collections.defaultdict(set))
    for x in rows:
        for n in lineup(x): gp[gk(x)][n].add(pkey(x))
    # ---- per game
    for key, lab in GAMES.items():
        gs = SLUG(key[0] + key[1]); G = [x for x in rows if gk(x) == key]; game = gs; tour = key[0]
        add('g-' + gs, f'played in {lab}', f'who played in {lab}', {n: len(v) for n, v in gp[key].items()}, False, 'game-played', game, tour)
        add('gt-' + gs, f'touched it in {lab}', f'who touched the disc (a catch or a throw) in {lab}', collections.Counter(n for x in G for n in touch(x)), False, 'game-touch', game, tour)
        add('gc-' + gs, f'caught it in {lab}', f'who caught the disc in {lab}', collections.Counter(g(x, 'Receiver') for x in G if catch(x)), False, 'game-catch', game, tour)
        add('gk-' + gs, f'completed a throw in {lab}', f'who completed a throw in {lab}', collections.Counter(g(x, 'Passer') for x in G if catch(x)), False, 'game-comp', game, tour)
        add('gd-' + gs, f'got a D in {lab}', f'who got a D (block) in {lab}', collections.Counter(g(x, 'Defender') for x in G if E(x) == ('Defense', 'D')), False, 'game-d', game, tour)
        add('gg-' + gs, f'caught a goal in {lab}', f'who caught a goal in {lab}', collections.Counter(g(x, 'Receiver') for x in G if goal(x)), False, 'game-goal', game, tour)
        add('ga-' + gs, f'threw an assist in {lab}', f'who threw an assist in {lab}', collections.Counter(g(x, 'Passer') for x in G if goal(x)), False, 'game-ast', game, tour)
        # "N or more" per game: one threshold per kind, the one whose answer count is closest to 13
        def one(prefix, short, verb, counts, concept, ts):
            best = None
            for t in ts:
                hit = {n: v for n, v in counts.items() if ok(n) and v >= t}
                if 10 <= len(hit) <= 19 and (best is None or abs(len(hit) - 13) < abs(len(best[1]) - 13)): best = (t, hit)
            if best:
                t, hit = best
                add(f'{prefix}{t}-{gs}', f'{t}+ {short} in {lab}', f'who {verb.format(t=t)} in {lab}', hit, False, concept, game, tour)
        one('g', 'points', 'played {t} or more points', {n: len(v) for n, v in gp[key].items()}, 'game-pts', range(2, 13))
        one('gt', 'touches', 'touched the disc {t} or more times', collections.Counter(n for x in G for n in touch(x)), 'game-touchN', (2, 3, 4, 5))
        one('gc', 'catches', 'caught the disc {t} or more times', collections.Counter(g(x, 'Receiver') for x in G if catch(x)), 'game-catchN', (2, 3))
        one('gk', 'completed throws', 'completed {t} or more throws', collections.Counter(g(x, 'Passer') for x in G if catch(x)), 'game-compN', (2, 3))
        add('gto-' + gs, f'touched it on O points in {lab}', f'who touched the disc (a catch or a throw) on O points in {lab}', collections.Counter(n for x in G if g(x, 'Line') == 'O' for n in touch(x)), False, 'game-otouch', game, tour)
        add('gtd-' + gs, f'touched it on D points in {lab}', f'who touched the disc (a catch or a throw) on D points in {lab}', collections.Counter(n for x in G if g(x, 'Line') == 'D' for n in touch(x)), False, 'game-dtouch', game, tour)
    # ---- per tournament
    tp = collections.defaultdict(lambda: collections.defaultdict(set))
    for x in rows:
        for n in lineup(x): tp[g(x, 'Tournamemnt')][n].add(pkey(x))
    for t, lab in TOURS.items():
        T = [x for x in rows if g(x, 'Tournamemnt') == t]
        add('tp-' + t, f'played at {t}', f'who played at {lab}', {n: len(v) for n, v in tp[t].items()}, False, 'tour-pts', '', t)
        add('tc-' + t, f'caught the disc at {t}', f'who caught the disc at {lab}', collections.Counter(g(x, 'Receiver') for x in T if catch(x)), False, 'tour-catch', '', t)
        add('tk-' + t, f'completed a throw at {t}', f'who completed a throw at {lab}', collections.Counter(g(x, 'Passer') for x in T if catch(x)), False, 'tour-comp', '', t)
        add('tt-' + t, f'touched the disc at {t}', f'who touched the disc (a catch or a throw) at {lab}', collections.Counter(n for x in T for n in touch(x)), False, 'tour-touch', '', t)
        add('tg-' + t, f'caught a goal at {t}', f'who caught a goal at {lab}', collections.Counter(g(x, 'Receiver') for x in T if goal(x)), False, 'tour-goal', '', t)
        add('ta-' + t, f'threw an assist at {t}', f'who threw an assist at {lab}', collections.Counter(g(x, 'Passer') for x in T if goal(x)), False, 'tour-ast', '', t)
        add('td-' + t, f'got a D at {t}', f'who got a D (block) at {lab}', collections.Counter(g(x, 'Defender') for x in T if E(x) == ('Defense', 'D')), False, 'tour-d', '', t)
        add('tta-' + t, f'threw it away at {t}', f'who threw it away at {lab}', collections.Counter(g(x, 'Passer') for x in T if E(x) == ('Offense', 'Throwaway')), False, 'tour-ta', '', t)
        add('tpull-' + t, f'pulled at {t}', f'who pulled at {lab}', collections.Counter(g(x, 'Defender') for x in T if E(x)[1] in ('Pull', 'PullOb')), False, 'tour-pull', '', t)
        add('tcpp-' + t, f'a catch every 2 points at {t}', f'who caught the disc at least once every 2 points they played at {t} ({lab.split("(")[1][:-1]}, min 5 points there)',
            {n: R(c / len(tp[t][n])) for n, c in collections.Counter(g(x, 'Receiver') for x in T if catch(x)).items() if ok(n) and len(tp[t][n]) >= 5 and c / len(tp[t][n]) >= .5}, True, 'tour-catchrate', '', t)
        for k in (3, 5, 8):
            hit = {n: v for n, v in collections.Counter(n for x in T for n in touch(x)).items() if v >= k}
            if 10 <= len(hit) <= 19:
                add(f'tt{k}-{t}', f'{k}+ touches at {t}', f'who touched the disc {k} or more times at {lab}', hit, False, 'tour-touchN', '', t)
        for k in (3, 5, 8):
            hit = {n: v for n, v in collections.Counter(g(x, 'Receiver') for x in T if catch(x)).items() if v >= k}
            if 10 <= len(hit) <= 19:
                add(f'tc{k}-{t}', f'{k}+ catches at {t}', f'who caught the disc {k} or more times at {lab}', hit, False, 'tour-catchN', '', t)
        for k in (3, 5, 8):
            hit = {n: v for n, v in collections.Counter(g(x, 'Passer') for x in T if catch(x)).items() if v >= k}
            if 10 <= len(hit) <= 19:
                add(f'tk{k}-{t}', f'{k}+ completed throws at {t}', f'who completed {k} or more throws at {lab}', hit, False, 'tour-compN', '', t)
    # ---- passer / receiver links at one tournament
    for t, lab in TOURS.items():
        TL = [x for x in rows if g(x, 'Tournamemnt') == t and catch(x) and ok(g(x, 'Passer')) and ok(g(x, 'Receiver'))]
        add('tdt-' + t, f'touched it on D points at {t}', f'who touched the disc (a catch or a throw) on D points at {lab}', collections.Counter(n for x in rows if g(x, 'Tournamemnt') == t and g(x, 'Line') == 'D' for n in touch(x)), False, 'tour-dtouch', '', t)
        add('tot-' + t, f'touched it on O points at {t}', f'who touched the disc (a catch or a throw) on O points at {lab}', collections.Counter(n for x in rows if g(x, 'Tournamemnt') == t and g(x, 'Line') == 'O' for n in touch(x)), False, 'tour-otouch', '', t)
        for p in sorted({g(x, 'Passer') for x in TL}):
            nm = full(p)
            add(f'tfrom-{t}-{SLUG(nm)}', f'caught a pass from {nm} at {t}', f'who caught a pass from {nm} at {lab}', collections.Counter(g(x, 'Receiver') for x in TL if g(x, 'Passer') == p), False, 'tour-from', '', t)
        for q in sorted({g(x, 'Receiver') for x in TL}):
            nm = full(q)
            add(f'tto-{t}-{SLUG(nm)}', f'completed a pass to {nm} at {t}', f'who completed a pass to {nm} at {lab}', collections.Counter(g(x, 'Passer') for x in TL if g(x, 'Receiver') == q), False, 'tour-to', '', t)
    # ---- passer / receiver links, every player (all catches, goals included)
    links = [x for x in rows if catch(x) and ok(g(x, 'Passer')) and ok(g(x, 'Receiver'))]
    for p in sorted({g(x, 'Passer') for x in links}):
        nm = full(p)
        add('from-' + SLUG(nm), f'caught a pass from {nm}', f'who caught a pass from {nm} this season', collections.Counter(g(x, 'Receiver') for x in links if g(x, 'Passer') == p), False, 'from')
    for q in sorted({g(x, 'Receiver') for x in links}):
        nm = full(q)
        add('to-' + SLUG(nm), f'completed a pass to {nm}', f'who completed a pass to {nm} this season', collections.Counter(g(x, 'Passer') for x in links if g(x, 'Receiver') == q), False, 'to')
    for line, word in (('O', 'O'), ('D', 'D')):
        LL = [x for x in links if g(x, 'Line') == line]
        for p in sorted({g(x, 'Passer') for x in LL}):
            nm = full(p)
            add(f'{line.lower()}from-' + SLUG(nm), f'caught a pass from {nm} on {word} points', f'who caught a pass from {nm} on {word} points this season', collections.Counter(g(x, 'Receiver') for x in LL if g(x, 'Passer') == p), False, f'{line.lower()}line-from')
        for q in sorted({g(x, 'Receiver') for x in LL}):
            nm = full(q)
            add(f'{line.lower()}to-' + SLUG(nm), f'completed a pass to {nm} on {word} points', f'who completed a pass to {nm} on {word} points this season', collections.Counter(g(x, 'Passer') for x in LL if g(x, 'Receiver') == q), False, f'{line.lower()}line-to')
    goals = [x for x in rows if goal(x) and ok(g(x, 'Passer')) and ok(g(x, 'Receiver'))]
    for p in sorted({g(x, 'Passer') for x in goals}):
        nm = full(p)
        add('gfrom-' + SLUG(nm), f'caught a goal from {nm}', f'who caught a goal from {nm} this season', collections.Counter(g(x, 'Receiver') for x in goals if g(x, 'Passer') == p), False, 'goalfrom')
    # ---- vs an opponent, across tournaments
    app = [x for x in rows if on(g(x, 'Opponent')) == 'App State']
    usc = [x for x in rows if g(x, 'Opponent') == 'USC']
    atleast = lambda c, t: {n: v for n, v in c.items() if ok(n) and v >= t}
    add('vs-app-touch', 'touched it vs App State', 'who touched the disc (a catch or a throw) against App State this season (any tournament)', collections.Counter(n for x in app for n in touch(x)), False, 'vs-app')
    add('vs-usc-catch', 'caught it vs USC', 'who caught the disc against USC at Barebones (Oct 3-4)', collections.Counter(g(x, 'Receiver') for x in usc if catch(x)), False, 'vs-usc')
    add('usc-touch', 'touched it vs USC', 'who touched the disc (a catch or a throw) against USC at Barebones (Oct 3-4)', collections.Counter(n for x in usc for n in touch(x)), False, 'vs-usc')
    add('usc-played', 'played vs USC', 'who played against USC at Barebones (Oct 3-4)', {n: len(v) for n, v in gp[('Barebones', 'USC')].items()}, False, 'vs-usc')
    add('app-catch3', 'caught it 3+ times vs App State', 'who caught the disc 3 or more times against App State this season (any tournament)', atleast(collections.Counter(g(x, 'Receiver') for x in app if catch(x)), 3), False, 'vs-app')
    add('app-touch5', 'touched it 5+ times vs App State', 'who touched the disc 5 or more times against App State this season (any tournament)', atleast(collections.Counter(n for x in app for n in touch(x)), 5), False, 'vs-app')
    add('app-comp', 'completed a throw vs App State', 'who completed a throw against App State this season (any tournament)', collections.Counter(g(x, 'Passer') for x in app if catch(x)), False, 'vs-app')
    add('app-goal', 'caught a goal vs App State', 'who caught a goal against App State this season (any tournament)', collections.Counter(g(x, 'Receiver') for x in app if goal(x)), False, 'vs-app')
    # ---- line splits and score situations
    dl = [x for x in rows if g(x, 'Line') == 'D']; ol = [x for x in rows if g(x, 'Line') == 'O']
    add('dtouch13', '13+ touches on D points', 'who touched the disc (a catch or a throw) 13 or more times on D points this season', atleast(collections.Counter(n for x in dl for n in touch(x)), 13), False, 'dtouch')
    add('dtouch6', '6+ touches on D points', 'who touched the disc (a catch or a throw) 6 or more times on D points this season', atleast(collections.Counter(n for x in dl for n in touch(x)), 6), False, 'dtouch')
    add('otouch26', '26+ touches on O points', 'who touched the disc (a catch or a throw) 26 or more times on O points this season', atleast(collections.Counter(n for x in ol for n in touch(x)), 26), False, 'otouch')
    for k in (4, 8, 10):
        add(f'dcatch{k}', f'{k}+ catches on D points', f'who caught the disc {k} or more times on D points this season', atleast(collections.Counter(g(x, 'Receiver') for x in dl if catch(x)), k), False, 'dcatch')
        add(f'ocatch{k}', f'{k}+ catches on O points', f'who caught the disc {k} or more times on O points this season', atleast(collections.Counter(g(x, 'Receiver') for x in ol if catch(x)), k), False, 'ocatch')
    def start(x):   # score at the start of the point a goal ended
        try: return int(g(x, 'Our Score - End of Point')) - 1, int(g(x, 'Their Score - End of Point'))
        except ValueError: return None
    behind = [x for x in rows if goal(x) and start(x) and start(x)[0] < start(x)[1]]
    level = [x for x in rows if goal(x) and start(x) and start(x)[0] == start(x)[1]]
    add('goal-behind', 'caught a goal while behind', 'who caught a goal while BatCH was behind in the game this season', collections.Counter(g(x, 'Receiver') for x in behind), False, 'goal-behind')
    add('ast-behind', 'threw an assist while behind', 'who threw an assist while BatCH was behind in the game this season', collections.Counter(g(x, 'Passer') for x in behind), False, 'ast-behind')
    add('goal-tied', 'caught a goal on a tied score', 'who caught a goal when the game was tied this season', collections.Counter(g(x, 'Receiver') for x in level), False, 'goal-tied')
    add('ast-tied', 'threw an assist on a tied score', 'who threw an assist when the game was tied this season', collections.Counter(g(x, 'Passer') for x in level), False, 'ast-tied')
    # ---- season ratios
    add('finish5', 'goals on 5%+ of catches', 'who caught a goal on 5% or more of their catches this season (min 5 catches)',
        {n: R(s(n, 'goal') / s(n, 'rec')) for n in N if s(n, 'rec') >= 5 and s(n, 'goal') / s(n, 'rec') >= .05}, True, 'finish')
    add('astshare3', 'assists on 3%+ of completions', 'who threw an assist on 3% or more of their completed throws this season (min 5 completions)',
        {n: R(s(n, 'ast') / s(n, 'comp')) for n in N if s(n, 'comp') >= 5 and s(n, 'ast') / s(n, 'comp') >= .03}, True, 'astshare')
    add('c2t', 'more catches than completions', 'who made more catches than completed throws this season (min 10 touches)',
        {n: R(s(n, 'rec') / max(1, s(n, 'comp'))) for n in N if s(n, 'rec') + thr(n) >= 10 and s(n, 'rec') > s(n, 'comp')}, True, 'c2t')
    add('t2c', 'more completions than catches', 'who completed more throws than they caught this season (min 10 touches)',
        {n: R(s(n, 'comp') / max(1, s(n, 'rec'))) for n in N if s(n, 'rec') + thr(n) >= 10 and s(n, 'comp') >= s(n, 'rec')}, True, 't2c')
    add('touchO1', 'a touch every O point', 'who averaged at least one touch (a catch or a throw) per O point they played this season (min 5 O points)',
        {n: R((s(n, 'rec') + thr(n)) / s(n, 'o')) for n in N if s(n, 'o') >= 5 and (s(n, 'rec') + thr(n)) / s(n, 'o') >= 1}, True, 'touchO')
    add('ddp25', 'a D every 25 D points', 'who got a D at least once every 25 D points they played this season (min 10 D points played)',
        {n: R(s(n, 'd') / s(n, 'dp')) for n in N if s(n, 'dp') >= 10 and s(n, 'd') / s(n, 'dp') >= 1 / 25}, True, 'drate')
    add('ddp12', 'a D every 12 D points', 'who got a D at least once every 12 D points they played this season (min 10 D points played)',
        {n: R(s(n, 'd') / s(n, 'dp')) for n in N if s(n, 'dp') >= 10 and s(n, 'd') / s(n, 'dp') >= 1 / 12}, True, 'drate')
    add('comp75', 'completed 75%+ of throws', 'who completed 75% or more of their throws this season (min 5 throws)',
        {n: R(s(n, 'comp') / thr(n)) for n in N if thr(n) >= 5 and s(n, 'comp') / thr(n) >= .75}, True, 'comp%')
    add('comp85', 'completed 85%+ of throws', 'who completed 85% or more of their throws this season (min 10 throws)',
        {n: R(s(n, 'comp') / thr(n)) for n in N if thr(n) >= 10 and s(n, 'comp') / thr(n) >= .85}, True, 'comp%')
    add('catch92', 'caught 92%+ of passes', 'who caught 92% or more of the passes thrown to them this season, drops counted (min 5 catches)',
        {n: R(s(n, 'rec') / (s(n, 'rec') + s(n, 'drop'))) for n in N if s(n, 'rec') >= 5 and s(n, 'rec') / (s(n, 'rec') + s(n, 'drop')) >= .92}, True, 'catch%')
    add('goal40', 'a goal every 40 points', 'who caught a goal at least once every 40 points they played this season (min 15 points played)',
        {n: R(s(n, 'goal') / s(n, 'pts')) for n in N if s(n, 'pts') >= 15 and s(n, 'goal') / s(n, 'pts') >= 1 / 40}, True, 'goalrate')
    add('goal15', 'a goal every 15 points', 'who caught a goal at least once every 15 points they played this season (min 15 points played)',
        {n: R(s(n, 'goal') / s(n, 'pts')) for n in N if s(n, 'pts') >= 15 and s(n, 'goal') / s(n, 'pts') >= 1 / 15}, True, 'goalrate')
    add('touch2', 'a touch every 2 points', 'who touched the disc (a catch or a throw) at least once every 2 points they played this season (min 15 points played)',
        {n: R((s(n, 'rec') + thr(n)) / s(n, 'pts')) for n in N if s(n, 'pts') >= 15 and (s(n, 'rec') + thr(n)) / s(n, 'pts') >= .5}, True, 'touchrate')
    add('touch1', 'a touch every point', 'who touched the disc (a catch or a throw) at least once per point they played this season (min 15 points played)',
        {n: R((s(n, 'rec') + thr(n)) / s(n, 'pts')) for n in N if s(n, 'pts') >= 15 and (s(n, 'rec') + thr(n)) / s(n, 'pts') >= 1}, True, 'touchrate')
    add('ta10', 'threw it away on 10%+ of throws', 'who threw it away on 10% or more of their throws this season (min 5 throws)',
        {n: R(s(n, 'ta') / thr(n)) for n in N if thr(n) >= 5 and s(n, 'ta') / thr(n) >= .1}, True, 'ta%')
    add('drop5', 'dropped 5%+ of passes', 'who dropped 5% or more of the passes thrown to them this season (min 5 catches)',
        {n: R(s(n, 'drop') / (s(n, 'rec') + s(n, 'drop'))) for n in N if s(n, 'rec') >= 5 and s(n, 'drop') / (s(n, 'rec') + s(n, 'drop')) >= .05}, True, 'drop%')
    # ---- season counts that are real stats (not minutes)
    cnt = lambda k, t: {n: s(n, k) for n in N if s(n, k) >= t}
    add('goal2', '2+ goals', 'who has caught 2 or more goals this season', cnt('goal', 2), False, 'goals')
    add('goal5', '5+ goals', 'who has caught 5 or more goals this season', cnt('goal', 5), False, 'goals')
    add('d2', '2+ Ds', 'who has gotten 2 or more Ds (blocks) this season', cnt('d', 2), False, 'ds')
    add('d4', '4+ Ds', 'who has gotten 4 or more Ds (blocks) this season', cnt('d', 4), False, 'ds')
    add('ta2', '2+ throwaways', 'who has thrown 2 or more throwaways this season', cnt('ta', 2), False, 'tas')
    add('ta10n', '10+ throwaways', 'who has thrown 10 or more throwaways this season', cnt('ta', 10), False, 'tas')
    add('ast1', 'an assist', 'who has thrown an assist this season', cnt('ast', 1), False, 'assists')
    add('ast3', '3+ assists', 'who has thrown 3 or more assists this season', cnt('ast', 3), False, 'assists')
    add('drop1', 'dropped a pass', 'who has dropped a pass this season', cnt('drop', 1), False, 'drops')
    add('rec10', '10+ catches', 'who has made 10 or more catches this season (goals included)', cnt('rec', 10), False, 'catches')
    add('rec14', '14+ catches', 'who has made 14 or more catches this season (goals included)', cnt('rec', 14), False, 'catches')
    add('rec50', '50+ catches', 'who has made 50 or more catches this season (goals included)', cnt('rec', 50), False, 'catches')
    add('comp8', '8+ completed throws', 'who has completed 8 or more throws this season (assists included)', cnt('comp', 8), False, 'comps')
    add('comp40', '40+ completed throws', 'who has completed 40 or more throws this season (assists included)', cnt('comp', 40), False, 'comps')
    add('g3-bankrununccx', '3+ points vs UNCCX', 'who played 3 or more points in the UNCCX game at Bankrun (Sept 20)', {n: len(v) for n, v in gp[('Bankrun', 'UNCCX')].items() if len(v) >= 3}, False, 'game-pts', 'bankrununccx', 'Bankrun')
    return C, {full(n): s(n, 'pts') for n in N}, pt_fame(rows)
