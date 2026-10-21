# run-daycontext.py - 21 Oct R&D (owner: "check from past days which stock might be strong today + today's moves/volume").
# For every stock-day: features known at 10:00 (yesterday's close position in its range, yesterday's volume vs usual, today's gap,
# first-45-min move and volume) -> outcome after 10:00: does price go +1% in the direction of the morning move before -1%?
# 50% = no edge; break-even after costs ~57%.
import json, sys, collections
d = json.load(open(sys.argv[1]))
one = json.load(open(sys.argv[2]))
X = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
def days_of(c):
    g = collections.defaultdict(list)
    for t, o, h, l, cl, v in c: g[t[:10]].append((t[11:16], o, h, l, cl, v))
    for k in g: g[k].sort()
    return g
rows = []
for s, v in d['results'].items():
    if 'candles' not in v or s not in one['results'] or 'candles' not in one['results'][s]: continue
    g = days_of([c for c in v['candles'] if c[0][:10] >= '2026-10-12'])
    g1 = days_of(one['results'][s]['candles'])
    ds = sorted(g)
    for i in range(1, len(ds)):
        y, t = g[ds[i-1]], g[ds[i]]
        if len(y) < 60 or len(t) < 60: continue
        yh, yl, yc = max(x[2] for x in y), min(x[3] for x in y), y[-1][4]
        yvol = sum(x[5] for x in y)
        prevvols = [sum(x[5] for x in g[ds[k]]) for k in range(max(0, i-4), i-1)]
        yrv = yvol / (sum(prevvols) / len(prevvols)) if prevvols else None
        ypos = (yc - yl) / (yh - yl) if yh > yl else 0.5
        yrange = (yh / yl - 1) * 100
        o = t[0][1]; gap = (o / yc - 1) * 100
        m = [x for x in t if x[0] < '10:00']
        if not m: continue
        p10 = m[-1][4]; mv = (p10 / o - 1) * 100
        mvol = sum(x[5] for x in m)
        ym = sum(x[5] for x in y if x[0] < '10:00')
        mrv = mvol / ym if ym else None
        dirn = 1 if mv > 0 else -1
        up, dn = p10 * (1 + X / 100), p10 * (1 - X / 100)
        res = None
        for b, oo, h, l, c, vv in g1.get(ds[i], []):
            if b < '10:00' or b >= '15:15': continue
            hu, hd = h >= up, l <= dn
            if hu and hd: res = 0; break
            if hu: res = 1 if dirn > 0 else 0; break
            if hd: res = 1 if dirn < 0 else 0; break
        if res is None: continue
        rows.append(dict(s=s, day=ds[i], res=res, dirn=dirn, mv=abs(mv), mrv=mrv, gap=gap * dirn, ypos=ypos if dirn > 0 else 1 - ypos, yrv=yrv, yrange=yrange, price=o))
print(f'{len(rows)} stock-days; follow-through of the 09:15-10:00 move by {X}% before -{X}%: {round(100*sum(r["res"] for r in rows)/len(rows))}%  (break-even ~{round((0.5+0.15/(2*X))*100)}%)')
def grp(name, f, cuts):
    out = []
    for lo, hi in cuts:
        x = [r['res'] for r in rows if f(r) is not None and lo <= f(r) < hi]
        out.append(f'{lo}-{hi}: {round(100*sum(x)/len(x)) if x else "-"}% ({len(x)})')
    print(f'  {name}: ' + ' | '.join(out))
grp('morning move %', lambda r: r['mv'], [(0, .5), (.5, 1), (1, 2), (2, 99)])
grp('morning volume vs yesterday morning', lambda r: r['mrv'], [(0, .8), (.8, 1.5), (1.5, 3), (3, 999)])
grp('gap in same direction %', lambda r: r['gap'], [(-99, -.5), (-.5, .5), (.5, 99)])
grp('yesterday closed near the extreme in our direction (0-1)', lambda r: r['ypos'], [(0, .3), (.3, .7), (.7, 1.01)])
grp('yesterday volume vs usual', lambda r: r['yrv'], [(0, .8), (.8, 1.5), (1.5, 999)])
grp('yesterday range %', lambda r: r['yrange'], [(0, 2), (2, 4), (4, 99)])
grp('price Rs', lambda r: r['price'], [(0, 200), (200, 500), (500, 2000), (2000, 1e9)])
both = [r['res'] for r in rows if r['mv'] >= 1 and (r['mrv'] or 0) >= 1.5 and r['ypos'] >= .7]
print(f'  COMBO morning move>=1% AND morning volume>=1.5x AND yesterday closed strong our way: {round(100*sum(both)/len(both)) if both else "-"}% ({len(both)})')
bd = collections.defaultdict(list)
for r in rows: bd[r['day']].append(r['res'])
print('  by day: ' + ' | '.join(f'{k} {round(100*sum(v)/len(v))}%' for k, v in sorted(bd.items())))
