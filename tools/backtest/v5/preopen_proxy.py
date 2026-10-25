# Pre-open study, PAST days (owner 25 Oct 17:45). True pre-open (09:00-09:15 order book) was never recorded before 26 Oct, so for the
# 9 past days we use what the pre-open LEAVES BEHIND: the opening price (= auction price) -> gap vs yesterday's close, and the 09:15
# first minute (auction quantity is printed at the open + first trades) -> opening volume vs the stock's own normal, opening-minute direction.
# Questions: (1) can we know the stocks in play at 09:16 instead of 09:20? (2) does the opening print predict the direction / which picks win?
import search,sim,numpy as np,collections
DAYS=sim.DAYS; COST,SLIP=sim.COST,sim.SLIP
def trade(g,D,last=60):
    B=D=='BUY'; sg=1 if B else -1; n=5
    lvl=g['h'][:n].max() if B else g['l'][:n].min(); opp=g['l'][:n].min() if B else g['h'][:n].max(); t=None
    for m in range(n,sim.SQ+1):
        if t is None:
            if m>last: return None
            if (g['h'][m]>lvl if B else g['l'][m]<lvl):
                e=(max(lvl,g['o'][m]) if B else min(lvl,g['o'][m]))*(1+sg*SLIP/100); rp=min(max(abs(e-opp)/e*100,0.5),1.5)
                t=dict(e=e,stop=e-sg*e*rp/100,risk=e*rp/100,best=0)
            continue
        h,l,c,o=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
        if m>=sim.SQ: x=c; break
        if (l<=t['stop'] if B else h>=t['stop']): x=min(t['stop'],o) if B else max(t['stop'],o); break
        t['best']=max(t['best'],((h if B else l)-t['e'])*sg/t['risk'])
        if t['best']>=1: t['stop']=(max if B else min)(t['stop'],t['e']+sg*(t['best']-1)*t['risk'])
    return (x*(1-sg*SLIP/100)-t['e'])*sg/t['risk']-COST/100*t['e']/t['risk']
rows=[]; h1=collections.defaultdict(list); h5=collections.defaultdict(list); early=[]
for di,d in enumerate(DAYS):
    G=search.cache[d]
    if di:
        feats=[]
        for s,g in G.items():
            if s.startswith('NIFTY') or search.liq.get(s,0)<25 or not h5[s] or not g['has'][:5].any(): continue
            pc=search.prevclose[d].get(s); o=g['open']
            if not pc: continue
            v=np.nan_to_num(g['v'])
            r1=v[0]/max(np.mean(h1[s][-10:]),1); r5=v[:5].sum()/max(np.mean(h5[s][-10:]),1)
            gap=(o/pc-1)*100; m1=np.sign(g['c'][0]-o); orD=np.sign(g['c'][4]-o)
            feats.append(dict(d=d,s=s,gap=gap,r1=r1,r5=r5,m1=m1,orD=orD,g=g))
        # 09:20 picks exactly like live: rvol>=3, Proposal B (skip gap-with > 1%), top 10
        cand=[f for f in feats if f['r5']>=3 and f['orD']!=0]
        for f in cand: f['gw']=f['gap']*f['orD']
        picks=sorted([f for f in cand if f['gw']<=1],key=lambda f:-f['r5'])[:10]
        top1=sorted(feats,key=lambda f:-f['r1'])
        P={f['s'] for f in picks}
        for k in (10,20,30): early.append((d,k,len(P & {f['s'] for f in top1[:k]}),len(P)))
        for f in picks:
            D='BUY' if f['orD']>0 else 'SELL'; R=trade(f['g'],D)
            if R is None: continue
            rows.append(dict(d=d,s=f['s'],D=D,gw=f['gw'],r1=f['r1'],r5=f['r5'],m1agree=f['m1']==f['orD'],gapagree=np.sign(f['gap'])==f['orD'],R=R,
                             auction_share=np.nan_to_num(f['g']['v'])[0]/max(np.nan_to_num(f['g']['v'])[:5].sum(),1)))
    for s,g in G.items():
        v=np.nan_to_num(g['v']); h1[s].append(v[0]); h5[s].append(v[:5].sum())
print('(1) EARLY LIST: of the 09:20 picks, how many were already in the top-K by OPENING-MINUTE volume at 09:16')
for k in (10,20,30):
    a=[e for e in early if e[1]==k]; print(f'   top {k}: {sum(x[2] for x in a)}/{sum(x[3] for x in a)} = {sum(x[2] for x in a)/max(sum(x[3] for x in a),1)*100:.0f}%')
def show(lbl,a):
    if not a: print(f'   {lbl:<44} n   0'); return
    R=[x['R'] for x in a]; b=[x['R'] for x in a if x['d']<'2026-10-19']; c=[x['R'] for x in a if x['d']>='2026-10-19']
    print(f'   {lbl:<44} n {len(a):>3} win {np.mean([r>0 for r in R])*100:3.0f}% net {sum(R):+6.1f}R avg {np.mean(R):+.2f} | build {sum(b):+5.1f} check {sum(c):+5.1f}')
print('(2) PICKS (Proposal B, trail-1R exit, no smart exit) split by what the OPENING showed')
show('all picks',rows)
show('opening minute moved OUR way',[x for x in rows if x['m1agree']]); show('opening minute moved AGAINST us',[x for x in rows if not x['m1agree']])
show('gap against us (reversal)',[x for x in rows if x['gw']<0]); show('gap 0-1% our way',[x for x in rows if 0<=x['gw']<=1])
q=np.percentile([x['r1'] for x in rows],[33,67])
show(f'opening-minute volume LOW (<{q[0]:.1f}x)',[x for x in rows if x['r1']<q[0]]); show('opening-minute volume MID',[x for x in rows if q[0]<=x['r1']<q[1]]); show(f'opening-minute volume HIGH (>={q[1]:.1f}x)',[x for x in rows if x['r1']>=q[1]])
a=np.median([x['auction_share'] for x in rows])
show(f'opening minute = big share of 5-min vol (>={a:.2f})',[x for x in rows if x['auction_share']>=a]); show('opening minute = small share',[x for x in rows if x['auction_share']<a])
show('gap against + opening minute our way',[x for x in rows if x['gw']<0 and x['m1agree']]); show('gap against + opening minute against',[x for x in rows if x['gw']<0 and not x['m1agree']])
show('gap our way + opening minute against',[x for x in rows if x['gw']>=0 and not x['m1agree']])
