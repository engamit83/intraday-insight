# search.py - nightly "test thousands of ideas" for STOCKS IN PLAY (rule 0b). Walk-forward: BUILD = earlier days, CHECK = later days.
import sim,numpy as np,collections,itertools,time,json,sys,multiprocessing as mp
DAYS=sim.DAYS
liq=sim.liquidity()
cache={d:sim.load_day(d)[0] for d in DAYS}
prevclose={}
for i,d in enumerate(DAYS[1:],1):
    G0=cache[DAYS[i-1]]; prevclose[d]={s:g['c'][-1] for s,g in G0.items()}
COST,SLIP=sim.COST,sim.SLIP
def run(p):
    hist=collections.defaultdict(list); out=[]
    for d in DAYS:
        G=cache[d]; n=p['OR']
        if d!=DAYS[0]:
            cand=[]
            for s,g in G.items():
                if s.startswith('NIFTY') or liq.get(s,0)<p['liq'] or not hist[s] or not g['has'][:n].any(): continue
                rv=g['v'][:n].sum()/max(np.mean(hist[s][-10:]),1)
                o=g['open']; c=g['c'][n-1]
                if c==o or rv<p['rvol']: continue
                D='BUY' if c>o else 'SELL'
                if p['gap']!='any':
                    pc=prevclose[d].get(s)
                    if pc is None: continue
                    gp=(o/pc-1)*100*(1 if D=='BUY' else -1)
                    if p['gap']=='with' and gp<0.3: continue
                    if p['gap']=='nofade' and gp<-0.3: continue
                rng=(g['h'][:n].max()-g['l'][:n].min())/o*100
                if rng>p['maxrng']: continue
                cand.append((rv,s,D))
            cand.sort(reverse=True)
            for rv,s,D in cand[:p['K']]:
                g=G[s]; B=D=='BUY'; sg=1 if B else -1
                orh,orl=g['h'][:n].max(),g['l'][:n].min(); lvl=orh if B else orl; opp=orl if B else orh
                t=None
                for m in range(n,sim.SQ+1):
                    if t is None:
                        if m>p['last']: break
                        if (g['h'][m]>lvl if B else g['l'][m]<lvl):
                            e=(max(lvl,g['o'][m]) if B else min(lvl,g['o'][m]))*(1+sg*SLIP/100)
                            rp=min(max(abs(e-opp)/e*100,p['smin']),p['smax']); risk=e*rp/100
                            t=dict(d=d,e=e,stop=e-sg*risk,risk=risk,best=0.0)
                            if (g['l'][m]<=t['stop'] if B else g['h'][m]>=t['stop']): t['x']=t['stop']; break
                        continue
                    h,l,c,o=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
                    if m>=sim.SQ or (p['tstop'] and m-n>=p['tstop'] and t['best']<0.5): t['x']=c; break
                    if (l<=t['stop'] if B else h>=t['stop']): t['x']=min(t['stop'],o) if B else max(t['stop'],o); break
                    t['best']=max(t['best'],((h if B else l)-t['e'])*sg/t['risk'])
                    if p['tgt'] and t['best']>=p['tgt']: t['x']=t['e']+sg*p['tgt']*t['risk']; break
                    if t['best']>=p['be']:
                        lock=t['e']+sg*(COST+2*SLIP)/100*t['e']
                        t['stop']=(max if B else min)(t['stop'],lock)
                    if p['trail'] and t['best']>=p['trail_from']:
                        t['stop']=(max if B else min)(t['stop'],t['e']+sg*(t['best']-p['trail'])*t['risk'])
                if t and 'x' in t:
                    f=t['x']*(1-sg*SLIP/100); out.append((d,(f-t['e'])*sg/t['risk']-COST/100*t['e']/t['risk']))
        for s,g in G.items(): hist[s].append(g['v'][:p['OR']].sum())
    return out
def score(tr):
    by=collections.defaultdict(float); n=collections.Counter()
    for d,r in tr: by[d]+=r; n[d]+=1
    R=[r for _,r in tr]
    build=sum(v for d,v in by.items() if d<'2026-10-19'); chk=sum(v for d,v in by.items() if d>='2026-10-19')
    return dict(n=len(R),net=sum(R),build=build,check=chk,win=np.mean([r>0 for r in R]) if R else 0,
                worst_day=min(by.values()) if by else 0,neg_days=sum(v<0 for v in by.values()),avg_loss=np.mean([r for r in R if r<0]) if any(r<0 for r in R) else 0,
                days={d[8:]:round(v,1) for d,v in sorted(by.items())})
GRID=dict(OR=[3,5,10],K=[5,10,15],rvol=[2,3,5],smin=[0.3,0.5],smax=[1.0,1.5,2.0,3.0],tgt=[0,2,3],trail=[0,0.5,1.0],trail_from=[1.0],be=[1.0,99],
          last=[30,60],tstop=[0,30],gap=['any','nofade'],maxrng=[99,3.0],liq=[25])
def one(vals):
    p=dict(zip(GRID.keys(),vals)); return p,score(run(p))
if __name__=='__main__':
    combos=list(itertools.product(*GRID.values()))
    print('variants',len(combos),flush=True); t0=time.time()
    with mp.Pool(mp.cpu_count()) as pool:
        res=pool.map(one,combos,chunksize=20)
    print('done in %.0fs'%(time.time()-t0))
    json.dump([(p,s) for p,s in res],open('search-results.json','w'),default=float)
