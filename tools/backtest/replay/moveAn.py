# Analysis of move-SYM.npz. Pass mark (written first): a factor/condition is USEFUL if the good-move rate is >= 1.5x the base rate
# in BOTH 2022-24 and 2025-26, with >= 100 cases each. Trade view: win +1.0%, loss -0.4%, cost 0.146% -> break-even good-rate 39%.
import numpy as np, sys
SYM=sys.argv[1]; z=np.load(f'move-{SYM}.npz'); A=z['A']; C=list(z['cols'])
col=lambda k: A[:,C.index(k)]
yr=np.array([(np.datetime64('1970-01-01')+np.timedelta64(int(d),'D')).astype(object).year for d in col('day')])
P1=yr<=2024; P2=yr>=2025; g=col('good'); mod=col('mod'); dr=col('dir'); day=col('day')
print(f'===== {SYM}: {len(np.unique(day))} days 2022-26, minutes x direction = {len(A)}')
print(f'base good-move rate: 22-24 {100*g[P1].mean():.1f}%  25-26 {100*g[P2].mean():.1f}%   (break-even for a +1%/-0.4% trade after costs = 39%)')
# 1) starts: first good minute of a run (same day, same direction)
key=day*10+dr+1; order=np.lexsort((mod,key)); st=np.zeros(len(A),bool)
prevk=None; prevg=0; prevm=-9
for i in order:
    k=key[i]
    st[i]= g[i]==1 and not (k==prevk and prevg==1 and mod[i]==prevm+1)
    prevk,prevg,prevm=k,g[i],mod[i]
print('\n1) GOOD MOVES (start minutes) per year: days with >=1 good move up / down, starts per day')
for y in range(2022,2027):
    m=yr==y
    if not m.any(): continue
    du=len(np.unique(day[m&st&(dr==1)])); dd=len(np.unique(day[m&st&(dr==-1)])); nd=len(np.unique(day[m]))
    print(f'  {y}: {nd} days | days with an UP move {du} ({100*du/nd:.0f}%) | DOWN move {dd} ({100*dd/nd:.0f}%) | starts per day {st[m].sum()/nd:.1f}')
print('  start time (share of starts):', '  '.join(f'{h:02d}h {100*np.mean((mod[st]//60)==h):.0f}%' for h in range(9,15)))
# 2) single factors
print('\n2) FACTORS at the minute of entry (signed in the trade direction): good-move rate per quintile, 22-24 | 25-26')
F=['gap','fromOpen','mom5','mom15','rvol5','vwapDist','dayRange','nifty15','niftyOpen','sector15','sectorOpen','prev1','ret5d','ret20d','vix','mod']
use=[]
for k in F:
    x=col(k); ok=~np.isnan(x)
    qs=np.unique(np.nanquantile(x[P1&ok],[0,.2,.4,.6,.8,1]))
    s=f'  {k:10}'; best=None
    for a,b in zip(qs[:-1],qs[1:]):
        m=ok&(x>=a)&(x<=b); r1=g[m&P1].mean() if (m&P1).sum() else 0; r2=g[m&P2].mean() if (m&P2).sum() else 0
        s+=f' [{a:.3g}..{b:.3g}] {100*r1:.0f}|{100*r2:.0f}'
        lift=min(r1/g[P1].mean(),r2/g[P2].mean())
        if lift>=1.5 and (m&P1).sum()>=100 and (m&P2).sum()>=100: use.append((k,a,b,r1,r2,lift))
    print(s)
for k in ['brkDay','brkPrev']:
    x=col(k); print(f'  {k:10} no: {100*g[(x==0)&P1].mean():.0f}|{100*g[(x==0)&P2].mean():.0f}  yes: {100*g[(x==1)&P1].mean():.0f}|{100*g[(x==1)&P2].mean():.0f} (n {int(((x==1)&P1).sum())}|{int(((x==1)&P2).sum())})')
    r1,r2=g[(x==1)&P1].mean(),g[(x==1)&P2].mean()
    if min(r1/g[P1].mean(),r2/g[P2].mean())>=1.5: use.append((k,1,1,r1,r2,min(r1/g[P1].mean(),r2/g[P2].mean())))
print('\n   USEFUL (>=1.5x base in BOTH periods):', '; '.join(f'{k} {a:.3g}..{b:.3g}: {100*r1:.0f}%|{100*r2:.0f}% (x{l:.1f})' for k,a,b,r1,r2,l in sorted(use,key=lambda t:-t[5])) or 'none')
# 3) all factors together: model built on 2022-24 only, checked on 2025-26
from sklearn.ensemble import HistGradientBoostingClassifier as HG
Xk=F+['brkDay','brkPrev','dir','weekday']; X=np.column_stack([col(k) for k in Xk])
m=HG(max_depth=4,learning_rate=0.05,max_iter=300,min_samples_leaf=300,l2_regularization=1.0).fit(X[P1],g[P1])
p=m.predict_proba(X[P2])[:,1]; g2=g[P2]; d2=day[P2]; mod2=mod[P2]
print('\n3) ALL FACTORS TOGETHER (model built on 2022-24, checked on 2025-26 which it never saw)')
for th in [0.3,0.4,0.5,0.6]:
    s=p>=th
    if s.sum(): print(f'  signal >= {th}: {s.sum()} minutes on {len(np.unique(d2[s]))} days, good-move rate {100*g2[s].mean():.0f}%  (base {100*g2.mean():.0f}%)')
# trade view: first signal of the day only, one trade per day
for th in [0.4,0.5,0.6]:
    res=[]
    for d in np.unique(d2):
        ix=np.nonzero((d2==d)&(p>=th))[0]
        if len(ix): i=ix[np.argmin(mod2[ix])]; res.append(1.0-0.146 if g2[i] else -0.4-0.146)
    if res: r=np.array(res); print(f'  one trade/day at first signal >= {th}: {len(r)} trades, right {100*(r>0).mean():.0f}%, avg {r.mean():+.2f}% after costs, total {r.sum():+.1f}% (worst-case: no-hit trades counted as losses)')
