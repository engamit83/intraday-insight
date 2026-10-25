# Owner idea 25 Oct 17:13: later entries only if BOTH the entry rule (volume spike + break) AND the base favour signs agree.
# Base signs on 1-min data (book needs live order book -> not available here, so 5 of the 6): flow~ volume of bars closing our way vs against (5 bars),
# volume (last-3 move our way on above-avg volume), vwap side, higher lows/lower highs (3 bars), Nifty 5-min not against (0.15%).
import search,sim,numpy as np,collections,itertools
COST,SLIP=sim.COST,sim.SLIP
def fav(g,N,m,sg,price):
    o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],np.nan_to_num(g['v'])
    b=range(m-5,m); up=sum(v[i] for i in b if c[i]>o[i]); dn=sum(v[i] for i in b if c[i]<o[i])
    w,a=(up,dn) if sg>0 else (dn,up)
    l3=[m-3,m-2,m-1]; avg=v[:m].mean()
    s=[w>=1.5*max(a,1),
       (c[m-1]-o[m-3])*sg>0 and v[m-3:m].mean()>avg,
       (price-g['vwap'][m-1])*sg>0,
       (l[l3[0]]<l[l3[1]]<l[l3[2]]) if sg>0 else (h[l3[0]]>h[l3[1]]>h[l3[2]]),
       not ((N['c'][m-1]/N['c'][m-6]-1)*100*sg<=-0.15)]
    return sum(s)
def run(p):
    hist=collections.defaultdict(list); out=[]
    for di,d in enumerate(sim.DAYS):
        G=search.cache[d]; N=G.get('NIFTY') or {'c':100*(1+np.nanmean([G[z]['so'] for z in sim.N50 if z in G],axis=0)/100)}
        if di:
            sig=[]
            for s,g in G.items():
                if s.startswith('NIFTY') or search.liq.get(s,0)<25 or not hist[s]: continue
                base=np.mean(hist[s][-10:])*5
                if base<=0: continue
                v=np.nan_to_num(g['v']); cs=np.concatenate([[0],np.cumsum(v)])
                for m in range(p['start'],p['end']+1):
                    if cs[m+1]-cs[m-4]<p['X']*base: continue
                    mv=(g['c'][m]/g['c'][m-5]-1)*100
                    if abs(mv)<p['mv'] or mv==0: continue
                    sig.append((m,s,'BUY' if mv>0 else 'SELL')); break
            sig.sort(); taken=0
            for m0,s,D in sig:
                if taken>=p['K']: break
                g=G[s]; B=D=='BUY'; sg=1 if B else -1
                hi,lo=g['h'][m0-4:m0+1].max(),g['l'][m0-4:m0+1].min(); lvl=hi if B else lo; opp=lo if B else hi; t=None
                for m in range(m0+1,sim.SQ+1):
                    if t is None:
                        if m>m0+15 or m>=sim.SQ: break
                        if not (g['h'][m]>lvl if B else g['l'][m]<lvl): continue
                        e=(max(lvl,g['o'][m]) if B else min(lvl,g['o'][m]))
                        if p['need'] and fav(g,N,m,sg,e)<p['need']: continue   # signs checked at the moment of the break
                        e*=(1+sg*SLIP/100); rp=min(max(abs(e-opp)/e*100,0.5),1.5); t=dict(e=e,stop=e-sg*e*rp/100,risk=e*rp/100,best=0)
                    h,l,c,o=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
                    if m>=sim.SQ: t['x']=c; break
                    if (l<=t['stop'] if B else h>=t['stop']): t['x']=min(t['stop'],o) if B else max(t['stop'],o); break
                    t['best']=max(t['best'],((h if B else l)-t['e'])*sg/t['risk'])
                    if t['best']>=1: t['stop']=(max if B else min)(t['stop'],t['e']+sg*(t['best']-1)*t['risk'])
                if t and 'x' in t: taken+=1; out.append((d,(t['x']*(1-sg*SLIP/100)-t['e'])*sg/t['risk']-COST/100*t['e']/t['risk']))
        for s,g in G.items(): hist[s].append(np.nanmean(g['v'][60:316]))
    return out
res=[]
for st,X,mv,K,need in itertools.product([60,105,165],[3,5,7],[0,0.3],[3,5],[0,3,4,5]):
    p=dict(start=st,end=min(st+150,300),X=X,mv=mv,K=K,need=need); res.append((p,search.score(run(p))))
for need in [0,3,4,5]:
    R=[s for p,s in res if p['need']==need]
    print(f"signs needed {need}: variants {len(R)} profitable {sum(s['net']>0 for s in R)} ({sum(s['net']>0 for s in R)/len(R)*100:.0f}%) both-halves+ {sum(s['build']>0 and s['check']>0 for s in R)} median net {np.median([s['net'] for s in R]):+.1f}R median win {np.median([s['win'] for s in R])*100:.0f}% median avg-loss {np.median([s['avg_loss'] for s in R]):.2f}R median trades {np.median([s['n'] for s in R]):.0f}")
for st in [60,105,165]:
    print('start',st,{need:round(float(np.median([s['net'] for p,s in res if p['need']==need and p['start']==st])),1) for need in [0,3,4,5]})
for p,s in sorted([r for r in res if r[0]['need']>=4],key=lambda r:-min(r[1]['build'],r[1]['check']))[:5]:
    print(p, f"n {s['n']} win {s['win']*100:.0f}% net {s['net']:+.1f}R build {s['build']:+.1f} check {s['check']:+.1f} worst {s['worst_day']:+.1f} lossdays {int(s['neg_days'])}")
