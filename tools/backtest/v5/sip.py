# "Stocks in play" opening-range breakout (the method day-trading desks use; cf. Zarattini & Aziz 2023 research on ORB + relative volume).
# Each day: rank liquid stocks by RELATIVE VOLUME of the first OR minutes vs their own average on previous days; trade only the top K.
# Direction = direction of the first OR candle (up -> BUY breakout of OR high, down -> SELL break of OR low). Stop = other side of the OR
# (min/max %), exit at 15:15 (let winners run) or trail after +1R. Optional market-regime filter. Costs + slippage included.
import sim,numpy as np,collections,copy,sys
liq=sim.liquidity()
DAYS=sim.DAYS
cache={d:sim.load_day(d) for d in DAYS}
P=dict(OR=5,K=20,min_rvol=1.5,stop_min=0.5,stop_max=2.0,regime=False,trail=False,last_entry=60,max_trades=20,target_R=0)
def orvol(G,s,n): g=G[s]; return g['v'][:n].sum()
def run(p):
    hist=collections.defaultdict(list); out=[]
    for d in DAYS:
        G,mk,book=cache[d]; n=p['OR']
        if d!=DAYS[0]:
            cand=[]
            for s,g in G.items():
                if s.startswith('NIFTY') or liq.get(s,0)<sim.P['liq_cr'] or not hist[s] or not g['has'][:n].any(): continue
                rv=orvol(G,s,n)/max(np.mean(hist[s]),1)
                o=g['open']; c=g['c'][n-1]
                if c==o or rv<p['min_rvol']: continue
                cand.append((rv,s,'BUY' if c>o else 'SELL'))
            cand.sort(reverse=True); picks=cand[:p['K']]
            if p['regime']:
                pass
            trades=0
            for rv,s,D in picks:
                g=G[s]; B=D=='BUY'; sg=1 if B else -1
                orh,orl=g['h'][:n].max(),g['l'][:n].min()
                lvl=orh if B else orl; stop_lvl=orl if B else orh
                t=None
                for m in range(n,sim.SQ+1):
                    if t is None:
                        if m>p['last_entry'] or trades>=p['max_trades']: break
                        if (g['h'][m]>=lvl if B else g['l'][m]<=lvl):
                            if p['regime']:
                                mso=mk['so'][m]
                                if (B and mso<0) or ((not B) and mso>0): break
                            entry=max(lvl,g['o'][m]) if B else min(lvl,g['o'][m]); entry*=1+sg*sim.SLIP/100
                            rp=abs(entry-stop_lvl)/entry*100; rp=min(max(rp,p['stop_min']),p['stop_max'])
                            risk=entry*rp/100; t=dict(s=s,D=D,day=d,entry=entry,stop=entry-sg*risk,risk=risk,best=0,inm=m,rv=rv); trades+=1
                            # same-bar stop check
                            if (g['l'][m]<=t['stop'] if B else g['h'][m]>=t['stop']):  # strict: any touch in the entry minute = stopped
                                t['exit']=t['stop']; t['why']='stop'; break
                        continue
                    h,l,c,o=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
                    if m>=sim.SQ: t['exit']=c; t['why']='15:15'; break
                    if (l<=t['stop'] if B else h>=t['stop']): t['exit']=min(t['stop'],o) if B else max(t['stop'],o); t['why']='stop' if t['best']<1 else 'trail'; break
                    t['best']=max(t['best'],((h if B else l)-t['entry'])*sg/t['risk'])
                    if p['target_R'] and t['best']>=p['target_R']: t['exit']=t['entry']+sg*p['target_R']*t['risk']; t['why']='target'; break
                    if p['trail'] and t['best']>=1:
                        t['stop']=max(t['stop'],t['entry']+ (t['best']-1)*t['risk']) if B else min(t['stop'],t['entry']-(t['best']-1)*t['risk'])
                if t and 'exit' in t:
                    fill=t['exit']*(1-sg*sim.SLIP/100)
                    t['R']=(fill-t['entry'])*sg/t['risk']-(sim.COST/100)*t['entry']/t['risk']; t['gross']=(fill-t['entry'])*sg/t['entry']*100
                    out.append(t)
        for s,g in G.items(): hist[s].append(orvol(G,s,p['OR']))
    return out
def rep(tr,name):
    by=collections.defaultdict(list)
    for t in tr: by[t['day']].append(t)
    n=len(tr); net=sum(t['R'] for t in tr); win=sum(1 for t in tr if t['R']>0)
    b=sum(t['R'] for t in tr if t['day']<'2026-10-19'); c=sum(t['R'] for t in tr if t['day']>='2026-10-19')
    print(f"{name:<38} n {n:>3} win {100*win/max(n,1):3.0f}% net {net:+6.1f}R avg {net/max(n,1):+.2f}R gross/trade {np.mean([t['gross'] for t in tr]) if tr else 0:+.2f}% | build {b:+.1f} check {c:+.1f} | "+' '.join(f"{d[8:]}:{sum(t['R'] for t in v):+.1f}({len(v)})" for d,v in sorted(by.items())))
if __name__=='__main__':
    def V(**k): q=copy.deepcopy(P); q.update(k); return q
    for name,p in [('SIP base: OR5 top20 hold to 15:15',V()),('+ market filter',V(regime=True)),('top10',V(K=10)),('OR15',V(OR=15,last_entry=90)),
                   ('trail after 1R',V(trail=True)),('target 2R',V(target_R=2)),('top10 + market filter',V(K=10,regime=True)),('rvol>=3',V(min_rvol=3))]:
        rep(run(p),name)
