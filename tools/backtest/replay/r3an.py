# R3 + SUPPORT FACTORS -> SELL NOW rule. Build 2022-24, check 2025-26. First signal per R3 stock-day.
# Trade: sell, target -2%, stop +0.5%, else 15:15; cost 0.146%. Also report CLEAN % (2% fall, never above the sell price).
# PASS MARK (written first): after costs > 0 in BOTH periods, >= 60 trades each, positive in >= 4 of 5 years; clean % higher than plain R3.
import numpy as np
z=np.load('r3f.npz'); A=z['A']; C=list(z['cols']); col=lambda k: A[:,C.index(k)]
o=np.lexsort((col('time'),col('sd'))); A=A[o]
sd=col('sd').astype(int); day=col('day').astype(int)
yr=(np.datetime64('1970-01-01')+day.astype('timedelta64[D]')).astype('datetime64[Y]').astype(int)+1970
P1=yr<=2024; P2=yr>=2025; clean=col('clean'); tr=col('tr')-0.146
F=[c for c in C if c not in ('sd','day','clean','tr')]
def first(m):
    ix=np.nonzero(m)[0]
    if len(ix)==0: return ix
    _,f=np.unique(sd[ix],return_index=True); return ix[f]
def rep(name,m):
    out=[]
    for P in (P1,P2):
        f=first(m&P); out.append((len(f),tr[f].mean() if len(f) else 0,100*clean[f].mean() if len(f) else 0,100*np.mean(tr[f]>0) if len(f) else 0))
    ys=[tr[first(m&(yr==y))].sum() for y in range(2022,2027)]
    ok=out[0][0]>=60 and out[1][0]>=60 and out[0][1]>0 and out[1][1]>0 and sum(x>0 for x in ys)>=4
    print(f"  {'PASS' if ok else ' -  '} {name}\n       2022-24: {out[0][0]} trades, avg {out[0][1]:+.3f}%, clean 2% {out[0][2]:.0f}%, win {out[0][3]:.0f}% | 2025-26: {out[1][0]} trades, avg {out[1][1]:+.3f}%, clean 2% {out[1][2]:.0f}%, win {out[1][3]:.0f}% | per year %: {' '.join(f'{x:+.0f}' for x in ys)}")
    return ok
print(f'R3 stock-days {len(np.unique(sd))}; minutes {len(A)}; clean-2% minutes {100*clean.mean():.1f}%')
print('\nBASELINE (R3 as it is: sell at 09:20):'); rep('R3 sell at 09:20',col('time')==560)
print('\n1) SUPPORT FACTORS ALONE: clean-2% rate when present vs base (build | check), thresholds from 2022-24 fifths')
conds=[]; b1,b2=clean[P1].mean(),clean[P2].mean()
for f in F:
    x=col(f); ok=~np.isnan(x); u=np.unique(x[ok&P1])
    if len(u)<=2:
        for val in u: conds.append((f'{f}=={val:g}',x==val));
        continue
    for q in (0.2,0.4,0.6,0.8):
        t=np.nanquantile(x[P1],q); conds.append((f'{f}>={t:.3g}',ok&(x>=t))); conds.append((f'{f}<={t:.3g}',ok&(x<=t)))
lift=[]
for n,m in conds:
    if (m&P1).sum()<2000 or (m&P2).sum()<1000: continue
    l1=clean[m&P1].mean()/b1; l2=clean[m&P2].mean()/b2; lift.append((min(l1,l2),n,l1,l2,m[clean==1].mean()))
lift.sort(reverse=True)
for s,n,l1,l2,share in lift[:20]: print(f'   {n:24} x{l1:.2f} | x{l2:.2f}   (present in {100*share:.0f}% of clean moves)')
print('\n2) RULES: R3 + 1-3 support factors (beam search on 2022-24 only)')
CD=dict(conds); beam=[()]; res=[]; tried=0
for depth in range(3):
    cand=[]
    for names in beam:
        m0=np.ones(len(A),bool)
        for q in names: m0&=CD[q]
        for n,c in conds:
            if n in names: continue
            tried+=1; f=first(m0&c&P1)
            if len(f)>=100: cand.append((tr[f].mean(),names+(n,)))
    cand.sort(key=lambda t:-t[0]); beam=[]; seen=set()
    for s,names in cand:
        k=tuple(sorted(names))
        if k in seen: continue
        seen.add(k); beam.append(names); res.append((s,names))
        if len(beam)>=20: break
print(f'   ({tried} variants tried -> strict luck bar)')
res.sort(key=lambda t:-t[0]); shown=0
for s,names in res:
    m=np.ones(len(A),bool)
    for q in names: m&=CD[q]
    rep(' AND '.join(names),m); shown+=1
    if shown>=12: break
