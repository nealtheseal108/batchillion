"""Tier rules for Batchillion stat questions (the same rules as the scratchpad stat_gen2.py, and as the game's
JavaScript port in app.js crowdTiers; tools/crowd_port_test.js checks they agree). Standard library only.

tiers(): biggest value is plankton (ties share); one in a batchillion only if exactly one person has the smallest
value; at most 2 deep cuts (a group of 1-2 at the bottom, or just above the batchillion); rares unlimited; about
the top quarter of the rest is schooler. Ratio questions rank by place in the ratio range plus share of points
played; counts rank by the raw value. A playing-time cap then limits how obvious an answer can be.
"""
import json

TP = {'plankton': 10, 'schooler': 30, 'rare': 60, 'deep': 85, 'krillion': 100}
ORDER = ['plankton', 'schooler', 'rare', 'deep', 'krillion']
# Neal (11/7): schooler is the default, like the median; rare is only for people clearly below it.
SCHOOLER_SHARE = 0.65


def tiers(cnt):
    counts = sorted(set(cnt.values()), reverse=True)
    groups = [sorted(n for n, c in cnt.items() if c == v) for v in counts]
    out = {}
    if not groups: return out
    for n in groups[0]: out[n] = 'plankton'
    if len(groups) == 1: return out
    lo = len(groups) - 1
    if len(groups[lo]) == 1:
        out[groups[lo][0]] = 'krillion'; lo -= 1
        if lo >= 1 and len(groups[lo]) <= 2:
            for n in groups[lo]: out[n] = 'deep'
            lo -= 1
    elif len(groups[lo]) <= 2:
        for n in groups[lo]: out[n] = 'deep'
        lo -= 1
    if lo == len(groups) - 1 and lo >= 1:
        for n in groups[lo]: out[n] = 'rare'
        lo -= 1
    mid = groups[1:lo + 1]
    people = sum(len(g) for g in mid) + sum(1 for n in out if out[n] in ('rare', 'deep', 'krillion'))
    target = round(people * SCHOOLER_SHARE); seen = 0
    for g_ in mid:
        tier = 'schooler' if seen + len(g_) <= max(target, 1) else 'rare'
        for n in g_: out[n] = tier
        seen += len(g_)
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


def tier_question(values, ratio, pp, ptf):
    ob = prior(values, ratio, pp)
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


def prompt_js(pid, short, text, tm, ob, values=None, ratio=False):
    extra = (f', v: {json.dumps(dict(sorted(values.items())))}' if values else '') + (', ratio: true' if ratio else '')
    return (f'      {{ id: {json.dumps(pid)}, short: {json.dumps(short)}, text: {json.dumps(text)}, '
            f'tiers: {json.dumps(dict(sorted(tm.items())))}, ob: {json.dumps(dict(sorted(ob.items())))}{extra} }}')
