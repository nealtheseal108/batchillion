"""Tier rules for Batchillion stat questions (the same rules as the scratchpad stat_gen2.py, and as the game's
JavaScript port in app.js crowdTiers; tools/crowd_port_test.js checks they agree). Standard library only.

tiers(): biggest value is plankton (ties share); one in a batchillion only if exactly one person has the smallest
value; at most 2 deep cuts (a group of 1-2 at the bottom, or just above the batchillion); rares unlimited; about
the top quarter of the rest is schooler. Ratio questions rank by place in the ratio range plus share of points
played; counts rank by the raw value. A playing-time cap then limits how obvious an answer can be.
"""
import json, math

TP = {'plankton': 10, 'schooler': 30, 'rare': 60, 'deep': 85, 'krillion': 100}
ORDER = ['plankton', 'schooler', 'rare', 'deep', 'krillion']


def _ceil(x):
    return math.ceil(x - 1e-9)   # "round up", without float noise turning 3.0 into 4


def tiers(cnt):
    """Neal's split (11/7): rank every answer by its score; top 20% plankton, next 40% schooler, next 25%
    rare, last 15% deep cut, each cut rounded up. A single lowest answer, if there is one, is the one in a
    batchillion and sits outside the split. Tied answers share a tier: the tier where the group starts."""
    levels = sorted(set(cnt.values()), reverse=True)
    groups = [sorted(n for n, c in cnt.items() if c == v) for v in levels]
    out = {}
    if not groups: return out
    if len(groups) == 1:
        return {n: 'plankton' for n in groups[0]}
    kr = groups[-1][0] if len(groups[-1]) == 1 else None
    if kr: groups = groups[:-1]
    n = sum(len(g) for g in groups)
    c1, c2, c3 = _ceil(.2 * n), _ceil(.6 * n), _ceil(.85 * n)
    seen = 0
    for g in groups:
        t = 'plankton' if seen < c1 else 'schooler' if seen < c2 else 'rare' if seen < c3 else 'deep'
        for x in g: out[x] = t
        seen += len(g)
    if kr: out[kr] = 'krillion'
    return out


def cap_for(n, ptf):
    v = ptf.get(n, 0)
    return 'plankton' if v >= 1.10 else 'schooler' if v >= 0.90 else 'rare'


def capped(tm, ob, ptf):
    out = {n: (t if ORDER.index(t) >= ORDER.index(cap_for(n, ptf)) else cap_for(n, ptf)) for n, t in tm.items()}
    if 'plankton' not in out.values():
        ok = [n for n, t in out.items() if t == 'schooler' and cap_for(n, ptf) == 'plankton']
        if ok:
            top = max(ob[n] for n in ok)
            for n in ok:
                if ob[n] == top: out[n] = 'plankton'
    return out


def prior(cnt, ratio, pp):
    if ratio:
        lo, hi = min(cnt.values()), max(cnt.values()); mp = max(pp.get(n, 0) for n in cnt) or 1
        o = {n: round(((v - lo) / (hi - lo) if hi > lo else 1) + 1.0 * pp.get(n, 0) / mp, 3) for n, v in cnt.items()}
        stat = {n: v / 2 for n, v in o.items()}
    else:
        lo, hi = min(cnt.values()), max(cnt.values())
        stat = {n: ((v - lo) / (hi - lo) if hi > lo else 1.0) for n, v in cnt.items()}
    return {n: round(stat[n], 3) for n in cnt}


def break_bottom_tie(ob, pp):
    """Neal (11/8): when several answers tie for the lowest score, the one with the most points played this season
    is the one in a batchillion (doing it least despite the most minutes is the rarest answer). The rest of the tied
    group moves up 0.001 so the game's own tier rules (app.js tierize) see a single lowest too."""
    lo = min(ob.values()); low = [n for n, v in ob.items() if v == lo]
    above = [v for v in ob.values() if v > lo]
    if len(low) < 2 or not above or round(lo + 0.001, 3) >= min(above): return ob
    pick = max(low, key=lambda n: (pp.get(n, 0), n))
    return {n: (round(v + 0.001, 3) if n in low and n != pick else v) for n, v in ob.items()}


def tier_question(values, ratio, pp, ptf):
    ob = break_bottom_tie(prior(values, ratio, pp), pp)
    return capped(tiers(ob), ob, ptf), ob


def distinct_max(tier_maps):
    """Most yards a round can give when each name counts once per round."""
    C = [sorted(((n, TP[t]) for n, t in tm.items()), key=lambda kv: -kv[1])[:7] for tm in tier_maps]
    best = [0]
    top = [c[0][1] if c else 0 for c in C]
    def go(k, used, s):
        if k == len(C): best[0] = max(best[0], s); return
        if s + sum(top[k:]) <= best[0]: return
        for n, v in C[k]:
            if n not in used:
                used.add(n); go(k + 1, used, s + v); used.discard(n)
    go(0, set(), 0)
    return best[0]


def prompt_js(pid, short, text, tm, ob, values=None, ratio=False, parts=None, nf=''):
    extra = (f', v: {json.dumps(dict(sorted(values.items())))}' if values else '') + (', ratio: true' if ratio else '')
    if parts: extra += f', parts: {json.dumps(dict(sorted(parts.items())))}, nf: {json.dumps(nf)}'
    return (f'      {{ id: {json.dumps(pid)}, short: {json.dumps(short)}, text: {json.dumps(text)}, '
            f'tiers: {json.dumps(dict(sorted(tm.items())))}, ob: {json.dumps(dict(sorted(ob.items())))}{extra} }}')
