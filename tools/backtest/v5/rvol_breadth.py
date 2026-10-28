# 9 history days (1-min): picks by rvol band, with/against 09:20 breadth, Proposal B gap rule, trail-1R exit
exec(open('/home/claude/v5/daytype.py').read().split("rows=[]; prevc=None")[0])
import collections
h5=collections.defaultdict(list); out=[]
for di,d in enumerate(DAYS):
    G=search.cache[d]; liq=[s for s,g in G.items() if not s.startswith('NIFTY') and search.liq.get(s,0)>=25]
    b920=np.mean([G[s]['c'][4]>G[s]['open'] for s in liq if np.isfinite(G[s]['c'][4])])*100
    if di:
        for s in liq:
            g=G[s]
            if not h5[s] or not g['has'][:5].any(): continue
            pc=search.prevclose[d].get(s)
            if not pc: continue
            r5=np.nan_to_num(g['v'])[:5].sum()/max(np.mean(h5[s][-10:]),1); orD=np.sign(g['c'][4]-g['open'])
            if orD==0 or (g['open']/pc-1)*100*orD>1: continue
            D='BUY' if orD>0 else 'SELL'; R=trade(g,D)
            if R is None: continue
            agree=not ((D=='BUY' and b920<45) or (D=='SELL' and b920>55))
            out.append((d,r5,agree,R))
    for s,g in G.items(): h5[s].append(np.nan_to_num(g['v'])[:5].sum())
def sh(l,a):
    R=[x[3] for x in a]; b=sum(x[3] for x in a if x[0]<'2026-10-19'); c=sum(x[3] for x in a if x[0]>='2026-10-19')
    print(f"{l:<34} n {len(a):>4} win {np.mean([r>0 for r in R])*100:3.0f}% avg {np.mean(R):+.2f}R total {sum(R):+6.1f}R | build {b:+5.1f} check {c:+5.1f}")
for lo,hi in [(3,99),(2,3),(1.5,2),(1,1.5),(0,1)]:
    sh(f"rvol {lo}-{hi} with breadth",[x for x in out if lo<=x[1]<hi and x[2]]); sh(f"rvol {lo}-{hi} against",[x for x in out if lo<=x[1]<hi and not x[2]])
