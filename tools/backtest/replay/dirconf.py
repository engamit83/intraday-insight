# DIRECTION CONFIRMATION (rule 0s; nightly block 14 Nov 21:30). Old data decides here (09:20 decision, rule 0w).
# PASS MARK (written before results): in EVERY walk-forward test year 2024, 2025, 2026 the confirmed side must be right at 15:14 >= 3 points above
# BOTH baselines for that side (current 09:20 rule on the same side, and 'always that side' on all picks), clean >=1.5% >= 1.2x the current same-side
# rate, and keep >= 1 pick a day on average. Thresholds chosen on earlier years only.
import json, numpy as np, pandas as pd, itertools
R=pd.DataFrame(json.load(open('dirfac-rows.json'))); R['y']=R.day.str[:4].astype(int); R=R[R.eod!=0].copy()
days_per_year=R.groupby('y').day.nunique()
def stats(S,side):
    if len(S)==0: return 0,np.nan,np.nan
    right=100*(np.sign(S.mv)==side).mean(); clean=100*(S.dn.mean() if side==-1 else S.up.mean()); return len(S),right,clean
def rule(S,side,g,r):
    if side==-1: m=(S.pickDir==-1)&((S.gap>g)|(S.ret5>r))
    else: m=(S.pickDir==1)&((S.gap<-g)|(S.ret5<-r))
    return S[m]
grid=list(itertools.product([0,0.5,1.0],[0,2,5]))
for side,name in ((-1,'SELL'),(1,'BUY')):
    print(f'\n===== {name} side: confirmed by {"gap UP or 5-day RISE" if side==-1 else "gap DOWN or 5-day FALL"}')
    for ty in [2024,2025,2026]:
        tr=R[R.y<ty]; te=R[R.y==ty]
        def score(g,r):
            n,a,c=stats(rule(tr,side,g,r),side); return a if n>=len(tr)*0.05 else -1
        g,r=max(grid,key=lambda x: score(*x))
        n,a,c=stats(rule(te,side,g,r),side)
        n0,a0,c0=stats(te[te.pickDir==side],side)          # current rule, same side
        a1=100*(np.sign(te.mv)==side).mean()                # always that side
        ok=a>=max(a0,a1)+3 and c>=1.2*c0 and n>=days_per_year[ty]
        print(f'  test {ty}: chose gap>{g} or ret5>{r} | n {n} ({n/days_per_year[ty]:.1f}/day) right {a:.1f}% clean {c:.1f}% | current {name} right {a0:.1f}% clean {c0:.1f}% (n {n0}) | always-{name} {a1:.1f}% | {"PASS" if ok else "fail"}')
    # fixed simple versions, all years
    for g,r in [(0,99),(0.5,99),(1.0,99),(99,2),(99,5),(0.5,2)]:
        print(f'  fixed gap>{g} or ret5>{r}:',' | '.join(f"{y}: {stats(rule(R[R.y==y],side,g,r),side)[1]:.1f}% (n {stats(rule(R[R.y==y],side,g,r),side)[0]})" for y in [2022,2023,2024,2025,2026]))
