# run-earlyexit.py - 21 Oct R&D (owner: stocks that moved our way but did not reach the target - could we exit early?)
# Trade every stock-day in the direction of its 09:15-10:00 move, entry at the 10:00 price, target +1%, stop -1%, close 15:15.
# Compare exit rules by average NET % per trade after ~0.15% costs. Uses 1-minute candles (exact order of events).
import json, collections, sys
d = json.load(open('hist500-5minute-2026-10-21.json')); one = json.load(open('hist500-1minute-2026-10-21.json'))
COST = 0.15
def days_of(c):
    g = collections.defaultdict(list)
    for t, o, h, l, cl, v in c: g[t[:10]].append((t[11:16], o, h, l, cl, v))
    for k in g: g[k].sort()
    return g
trades = []
for s, v in d['results'].items():
    if 'candles' not in v or 'candles' not in one['results'].get(s, {}): continue
    g = days_of([c for c in v['candles'] if c[0][:10] >= '2026-10-12']); g1 = days_of(one['results'][s]['candles']); ds = sorted(g)
    for i in range(1, len(ds)):
        t = g[ds[i]]
        if len(t) < 60 or len(g[ds[i-1]]) < 60: continue
        m = [x for x in t if x[0] < '10:00']
        if not m: continue
        p = m[-1][4]; dirn = 1 if p > t[0][1] else -1
        bars = [x for x in g1.get(ds[i], []) if '10:00' <= x[0] < '15:16']
        if len(bars) < 100: continue
        trades.append((dirn, p, bars))
def run(rule):
    res = []
    for dirn, p, bars in trades:
        f = lambda x: dirn * (x / p - 1) * 100  # % in our favour
        stop, best, out = -1.0, 0.0, None
        cumv = cumpv = 0
        for k, (b, o, h, l, c, v) in enumerate(bars):
            hi, lo = (f(h), f(l)) if dirn > 0 else (f(l), f(h))
            if b >= '15:15': out = f(o); break
            if lo <= stop: out = stop; break
            if rule.get('target') and hi >= rule['target']: out = rule['target']; break
            best = max(best, hi)
            cumv += v; cumpv += v * (h + l + c) / 3
            if rule.get('lockAt') and best >= rule['lockAt']: stop = max(stop, rule.get('lockTo', 0.0))
            if rule.get('trailFrom') and best >= rule['trailFrom']: stop = max(stop, best - rule['trailGap'])
            if rule.get('timeExit') and b >= rule['timeExit']: out = f(c); break
            if rule.get('vwapExit') and best >= rule['vwapExit'] and cumv and f(c) < f(cumpv / cumv): out = f(c); break
        if out is None: out = f(bars[-1][4])
        res.append(out - COST)
    n = len(res); return n, sum(res) / n, sum(1 for x in res if x > 0) / n * 100, sum(res)
R = [
 ('A hold: target +1%, stop -1%, close 15:15', {'target': 1.0}),
 ('B lock buy price after +0.5%', {'target': 1.0, 'lockAt': 0.5, 'lockTo': 0.15}),
 ('C lock +0.25% after +0.5%', {'target': 1.0, 'lockAt': 0.5, 'lockTo': 0.25}),
 ('D trail 0.3% behind best after +0.5%', {'target': 1.0, 'trailFrom': 0.5, 'trailGap': 0.3}),
 ('E target 0.75% + lock buy price after +0.5%', {'target': 0.75, 'lockAt': 0.5, 'lockTo': 0.15}),
 ('F target 0.6%', {'target': 0.6}),
 ('G exit at 12:30 if not done', {'target': 1.0, 'timeExit': '12:30'}),
 ('H exit when price falls back through VWAP after +0.5%', {'target': 1.0, 'vwapExit': 0.5}),
 ('I = D + exit 13:30', {'target': 1.0, 'trailFrom': 0.5, 'trailGap': 0.3, 'timeExit': '13:30'}),
]
print(f'{len(trades)} trades (every stock-day, direction of the morning move, 12-19 Oct). Net after ~{COST}% costs:')
for name, r in R:
    n, avg, win, tot = run(r)
    print(f'  {name}: avg {avg:+.3f}% per trade | winners {win:.0f}% | total {tot:+.0f}% (= Rs {tot*1000:+,.0f} at Rs 1 lakh/trade)')
