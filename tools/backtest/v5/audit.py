# Expert audit tests on 9 days (1-min): base = live entry (stocks in play + Proposal B top 10) + trail 1R exit.
import search,sim,numpy as np,collections,itertools
COST,SLIP=sim.COST,sim.SLIP
def trades(p):
    hist=collections.defaultdict(list); out=[]
    for di,d in enumerate(sim.DAYS):
        G=search.cache[d]
        if di:
            prev=search.cache[sim.DAYS[di-1]]; cand=[]
            for s,g in G.items():
                if s.startswith('NIFTY') or search.liq.get(s,0)<25 or not hist[s] or not g['has'][:5].any() or s not in prev: continue
                rv=g['v'][:5].sum()/max(np.mean(hist[s][-10:]),1); o=g['open']; c=g['c'][4]
                if c==o or rv<3: continue
                D='BUY' if c>o else 'SELL'; sg=1 if D=='BUY' else -1
                gap=(o/prev[s]['c'][-1]-1)*100*sg
                if gap>1: continue
                cand.append((rv,s,D,gap))
            cand.sort(reverse=True)
            for rv,s,D,gap in cand[:p.get('K',10)]:
                g=G[s]; B=D=='BUY'; sg=1 if B else -1
                lvl=g['h'][:5].max() if B else g['l'][:5].min(); opp=g['l'][:5].min() if B else g['h'][:5].max()
                t=None
                for m in range(5,sim.SQ+1):
                    if t is None:
                        if m>60: break
                        if (g['h'][m]>lvl if B else g['l'][m]<lvl):
                            e=(max(lvl,g['o'][m]) if B else min(lvl,g['o'][m]))*(1+sg*SLIP/100)
                            rp=min(max(abs(e-opp)/e*100,0.5),1.5); t=dict(d=d,s=s,D=D,rv=rv,gap=gap,e=e,stop=e-sg*e*rp/100,risk=e*rp/100,best=0,inm=m,half=None,sect=None)
                            if (g['l'][m]<=t['stop'] if B else g['h'][m]>=t['stop']): t['x']=t['stop']; t['outm']=m; break
                        continue
                    h,l,c,o2=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
                    if m>=sim.SQ: t['x']=c; t['outm']=m; break
                    if (l<=t['stop'] if B else h>=t['stop']): t['x']=min(t['stop'],o2) if B else max(t['stop'],o2); t['outm']=m; break
                    t['best']=max(t['best'],((h if B else l)-t['e'])*sg/t['risk'])
                    if p.get('half') and t['half'] is None and t['best']>=p['half']: t['half']=t['e']+sg*p['half']*t['risk']
                    if t['best']>=1: t['stop']=(max if B else min)(t['stop'],t['e']+sg*(t['best']-1)*t['risk'])
                if t and 'x' in t:
                    full=(t['x']*(1-sg*SLIP/100)-t['e'])*sg/t['risk']
                    if t['half'] is not None:
                        hp=(t['half']*(1-sg*SLIP/100)-t['e'])*sg/t['risk']; full=0.5*hp+0.5*full
                    t['R']=full-COST/100*t['e']/t['risk']; out.append(t)
        for s,g in G.items(): hist[s].append(g['v'][:5].sum())
    return out
def rep(name,T,w=None):
    w=w or (lambda t:1.0)
    by=collections.defaultdict(float)
    for t in T: by[t['d'][8:]]+=t['R']*w(t)
    tot=sum(by.values()); risk=sum(w(t) for t in T)
    lose=sum(1 for t in T if t['R']<0)
    print(f"{name:<44} trades {len(T):>3} losing {lose:>2} net {tot:+6.1f}R (Rs{tot*1000:+,.0f}) per-R-risked {tot/risk:+.2f} worst day {min(by.values()):+.1f} lossdays {sum(v<0 for v in by.values())}",{k:round(v,1) for k,v in sorted(by.items())})
T=trades({})
rep('BASE: live entry (B, top10) + trail 1R',T)
# 3 position size by quality
rep('3a size 1.5x when gap AGAINST us (reversal)',T,lambda t:1.5 if t['gap']<0 else 1.0)
rep('3b size 1.5x when rvol 5-10x',T,lambda t:1.5 if 5<=t['rv']<10 else 1.0)
rep('3c size 1.5x reversal & rvol>=5, 0.5x weak',T,lambda t:1.5 if (t['gap']<0 and t['rv']>=5) else (0.5 if t['gap']>0 else 1.0))
# 4 exposure cap: max N open trades in the same direction at once
def cap(T,N):
    keep=[]
    for d in sorted(set(t['d'] for t in T)):
        day=sorted([t for t in T if t['d']==d],key=lambda t:t['inm'])
        for t in day:
            open_same=sum(1 for k in keep if k['d']==d and k['D']==t['D'] and k['inm']<=t['inm']<k['outm'])
            if open_same<N: keep.append(t)
    return keep
for N in (3,5): rep(f'4 exposure cap: max {N} open same direction',cap(T,N))
# 6 partial booking
for hR in (1.5,2,3): rep(f'6 book half at +{hR}R, trail the rest',trades({'half':hR}))
