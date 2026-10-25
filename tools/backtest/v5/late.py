# Audit item 9: "late stock in play" - sudden volume spike after 10:15 (not picked at 09:20). 9 days, 1-min.
# Spike = last-5-min volume >= X * the stock's normal 5-min volume (avg 10:15-14:30 of earlier days).
# Entry: break of the spike window high/low (or next open), stop = other side of window clamped 0.5-1.5%,
# exit = trail 1R behind best, square-off 15:15, costs + slippage. Walk-forward score from search.score.
import search,sim,numpy as np,collections,itertools,json
COST,SLIP=sim.COST,sim.SLIP
def run(p):
    hist=collections.defaultdict(list); out=[]
    for di,d in enumerate(sim.DAYS):
        G=search.cache[d]
        if di:
            sig=[]
            for s,g in G.items():
                if s.startswith('NIFTY') or search.liq.get(s,0)<25 or not hist[s]: continue
                base=np.mean(hist[s][-10:])*5
                if base<=0: continue
                v=np.nan_to_num(g['v']); cs=np.concatenate([[0],np.cumsum(v)])
                for m in range(p['start'],p['end']+1):
                    w=cs[m+1]-cs[m-4]
                    if w<p['X']*base: continue
                    mv=(g['c'][m]/g['c'][m-5]-1)*100
                    if abs(mv)<p['mv'] or mv==0: continue
                    D='BUY' if mv>0 else 'SELL'
                    if p['dir']=='day' and np.sign(g['so'][m])!=np.sign(mv): continue
                    if p['dir']=='vwap' and np.sign(g['c'][m]-g['vwap'][m])!=np.sign(mv): continue
                    if p['dir']=='fade': D='SELL' if D=='BUY' else 'BUY'
                    sig.append((m,-w/base,s,D)); break      # first spike of the day per stock
            sig.sort(); taken=0
            for m0,_,s,D in sig:
                if taken>=p['K']: break
                g=G[s]; B=D=='BUY'; sg=1 if B else -1
                hi,lo=g['h'][m0-4:m0+1].max(),g['l'][m0-4:m0+1].min()
                lvl=hi if B else lo; opp=lo if B else hi; t=None
                for m in range(m0+1,sim.SQ+1):
                    if t is None:
                        if m>m0+p['wait'] or m>=sim.SQ: break
                        if p['entry']=='now': e=g['o'][m]*(1+sg*SLIP/100)
                        elif (g['h'][m]>lvl if B else g['l'][m]<lvl): e=(max(lvl,g['o'][m]) if B else min(lvl,g['o'][m]))*(1+sg*SLIP/100)
                        else: continue
                        rp=min(max(abs(e-opp)/e*100,0.5),1.5); t=dict(e=e,stop=e-sg*e*rp/100,risk=e*rp/100,best=0)
                        if p['entry']=='now': continue
                    h,l,c,o=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
                    if m>=sim.SQ: t['x']=c; break
                    if (l<=t['stop'] if B else h>=t['stop']): t['x']=min(t['stop'],o) if B else max(t['stop'],o); break
                    t['best']=max(t['best'],((h if B else l)-t['e'])*sg/t['risk'])
                    if t['best']>=1: t['stop']=(max if B else min)(t['stop'],t['e']+sg*(t['best']-1)*t['risk'])
                if t and 'x' in t:
                    taken+=1; out.append((d,(t['x']*(1-sg*SLIP/100)-t['e'])*sg/t['risk']-COST/100*t['e']/t['risk']))
        for s,g in G.items(): hist[s].append(np.nanmean(g['v'][60:316]))
    return out
grid=dict(X=[3,5,7,10],mv=[0,0.3,0.6],dir=['any','day','vwap','fade'],entry=['break','now'],end=[195,255,315],K=[5,10],start=[60],wait=[15])
keys=list(grid); res=[]
for vals in itertools.product(*grid.values()):
    p=dict(zip(keys,vals)); tr=run(p)
    if len(tr)<10: continue
    s=search.score(tr); res.append((p,s))
res.sort(key=lambda r:-r[1]['check'])
prof=sum(r[1]['net']>0 for r in res)
print(f"variants {len(res)}  profitable {prof} ({prof/len(res)*100:.0f}%)  median net {np.median([r[1]['net'] for r in res]):+.1f}R")
for p,s in res[:12]+[('--- worst ---',None)]+res[-3:]:
    if s is None: print(p); continue
    print({k:p[k] for k in ['X','mv','dir','entry','end','K']}, f"n {s['n']} win {s['win']*100:.0f}% net {s['net']:+.1f}R build {s['build']:+.1f} check {s['check']:+.1f} worst {s['worst_day']:+.1f} lossdays {int(s['neg_days'])}")
for k in keys:
    if len(grid[k])>1: print(k, {v:round(float(np.median([s['net'] for p,s in res if p[k]==v])),1) for v in grid[k]})
json.dump([(p,s) for p,s in res],open('late-results.json','w'),default=float)
