# Afternoon setups (expert audit item 5), 9 days, 1-min. Exit = trail 1R, stop 0.5-1.5%, square-off 15:15.
import search,sim,numpy as np,collections
COST,SLIP=sim.COST,sim.SLIP
def run(kind, start=255, end=315, rvmin=2.0, K=10):
    hist=collections.defaultdict(list); out=[]
    for di,d in enumerate(sim.DAYS):
        G=search.cache[d]
        if di:
            cand=[]
            for s,g in G.items():
                if s.startswith('NIFTY') or search.liq.get(s,0)<25 or not hist[s]: continue
                # "in play this afternoon": volume 12:45-13:30 vs the stock's average volume for that window
                w=g['v'][210:255].sum(); rv=w/max(np.mean(hist[s][-10:]),1)
                if rv<rvmin: continue
                if kind=='dayhl':     # break of the day's high/low made before 13:30, in the direction of the day's move
                    so=g['so'][254]; D='BUY' if so>0 else 'SELL'; lvl=g['h'][:255].max() if D=='BUY' else g['l'][:255].min()
                    opp=g['l'][210:255].min() if D=='BUY' else g['h'][210:255].max()
                elif kind=='midrange': # break of the 11:30-13:30 range, direction of the break
                    hi,lo=g['h'][135:255].max(),g['l'][135:255].min(); D=None; lvl=(hi,lo); opp=None
                elif kind=='vwap':    # trend day: price back above VWAP after being below (BUY) / mirror, direction of day
                    so=g['so'][254]; D='BUY' if so>0 else 'SELL'; lvl=None; opp=None
                cand.append((rv,s,D,lvl,opp))
            cand.sort(key=lambda x:-x[0])
            for rv,s,D,lvl,opp in cand[:K]:
                g=G[s]; t=None
                for m in range(start,sim.SQ+1):
                    if t is None:
                        if m>end: break
                        if kind=='midrange':
                            hi,lo=lvl
                            if g['h'][m]>hi: D='BUY'; L=hi; O=lo
                            elif g['l'][m]<lo: D='SELL'; L=lo; O=hi
                            else: continue
                        elif kind=='vwap':
                            sgn=1 if D=='BUY' else -1
                            if not ((g['c'][m-1]-g['vwap'][m-1])*sgn<0 and (g['c'][m]-g['vwap'][m])*sgn>0): continue
                            L=g['c'][m]; O=g['l'][m-10:m+1].min() if D=='BUY' else g['h'][m-10:m+1].max()
                        else:
                            L=lvl; O=opp
                            if not (g['h'][m]>L if D=='BUY' else g['l'][m]<L): continue
                        B=D=='BUY'; sg=1 if B else -1
                        e=(max(L,g['o'][m]) if B else min(L,g['o'][m]))*(1+sg*SLIP/100) if kind!='vwap' else g['c'][m]*(1+sg*SLIP/100)
                        rp=min(max(abs(e-O)/e*100,0.5),1.5); t=dict(e=e,stop=e-sg*e*rp/100,risk=e*rp/100,best=0,B=B,sg=sg)
                        continue
                    B,sg=t['B'],t['sg']; h,l,c,o=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
                    if m>=sim.SQ: t['x']=c; break
                    if (l<=t['stop'] if B else h>=t['stop']): t['x']=min(t['stop'],o) if B else max(t['stop'],o); break
                    t['best']=max(t['best'],((h if B else l)-t['e'])*sg/t['risk'])
                    if t['best']>=1: t['stop']=(max if B else min)(t['stop'],t['e']+sg*(t['best']-1)*t['risk'])
                if t and 'x' in t:
                    out.append((d,(t['x']*(1-t['sg']*SLIP/100)-t['e'])*t['sg']/t['risk']-COST/100*t['e']/t['risk']))
        for s,g in G.items(): hist[s].append(g['v'][210:255].sum())
    return out
for name,args in [('break of day high/low after 13:30 (day direction)',('dayhl',)),('break of 11:30-13:30 range after 13:30',('midrange',)),('VWAP reclaim after 13:30 (day direction)',('vwap',)),
                  ('day high/low break, afternoon rvol>=3',('dayhl',255,315,3.0)),('11:30-13:30 range break, rvol>=3',('midrange',255,315,3.0))]:
    s=search.score(run(*args)); print(f"{name:<48} n {s['n']:>3} win {s['win']*100:3.0f}% net {s['net']:+6.1f}R build {s['build']:+5.1f} check {s['check']:+5.1f} worst {s['worst_day']:+.1f} lossdays {int(s['neg_days'])}")
