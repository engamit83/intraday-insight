# Step 2 analysis. PASS MARK (written before looking): a direction rule must be right >=55% AND average move in its
# direction > 0.146% cost + 0.05% margin, in BOTH 2022-24 (build) and 2025-26 (check), with >=100 trades each.
import json,numpy as np,collections as C,sys
R=json.load(open('s2rows.json'))
COST=0.146
skip={'day','sym','sec','out'}
F=[k for k in R[0] if k not in skip]
A=[r for r in R if r['day']<'2025']; B=[r for r in R if r['day']>='2025']
def col(S,k): return np.array([float(r.get(k) or 0) for r in S])
yA=col(A,'out'); yB=col(B,'out')
def spear(x,y):
    rx=np.argsort(np.argsort(x)); ry=np.argsort(np.argsort(y)); return float(np.corrcoef(rx,ry)[0,1])
print(f'rows build {len(A)} check {len(B)}; base up% {100*(yA>0).mean():.1f} / {100*(yB>0).mean():.1f}; mean move {yA.mean():+.3f} / {yB.mean():+.3f}')
print('\n1) each factor alone: rank-correlation with the 09:20->15:14 move (same sign both periods = stable)')
res=[]
for k in F:
    a=spear(col(A,k),yA); b=spear(col(B,k),yB); res.append((k,a,b))
res.sort(key=lambda t:-min(abs(t[1]),abs(t[2])) if t[1]*t[2]>0 else 0)
for k,a,b in res[:25]: print(f'  {k:16} {a:+.3f} {b:+.3f} {"STABLE" if a*b>0 and min(abs(a),abs(b))>0.03 else ""}')
print('\n2) quintile view of the stable factors (up% / mean move %, build | check)')
for k,a,b in res[:10]:
    xa=col(A,k); qs=np.unique(np.quantile(xa,[0,.2,.4,.6,.8,1]))
    s=f'  {k:14}'
    for i in range(len(qs)-1):
        ma=(xa>=qs[i])&(xa<=qs[i+1]); xb=col(B,k); mb=(xb>=qs[i])&(xb<=qs[i+1])
        s+=f' [{qs[i]:.2g}..{qs[i+1]:.2g}] {100*(yA[ma]>0).mean():.0f}%/{yA[ma].mean():+.2f} | {100*(yB[mb]>0).mean() if mb.any() else 0:.0f}%/{yB[mb].mean() if mb.any() else 0:+.2f};'
    print(s)
# 3) model: gradient boosting trained on build years only, checked on 2025-26
try:
    from sklearn.ensemble import HistGradientBoostingRegressor as H
except ImportError:
    print('sklearn missing'); sys.exit()
XA=np.column_stack([col(A,k) for k in F]); XB=np.column_stack([col(B,k) for k in F])
m=H(max_depth=3,learning_rate=0.05,max_iter=200,min_samples_leaf=200,l2_regularization=1.0).fit(XA,yA)
pB=m.predict(XB)
print('\n3) model built on 2022-24 only, checked on 2025-26 (trade in predicted direction, hold 09:20->15:14)')
for th in [0,0.1,0.2,0.3,0.5]:
    s=np.abs(pB)>=th; g=np.sign(pB[s])*yB[s]
    if s.sum(): print(f'  |pred|>={th}: n={s.sum():5} right {100*(g>0).mean():.1f}%  avg {g.mean():+.3f}%  after cost {g.mean()-COST:+.3f}%')
# also yearly walk-forward: build on all earlier years, check next year
print('\n4) walk-forward per year (build on earlier years only)')
for y in ['2024','2025','2026']:
    Tr=[r for r in R if r['day']<y]; Te=[r for r in R if r['day'][:4]==y]
    X1=np.column_stack([col(Tr,k) for k in F]); X2=np.column_stack([col(Te,k) for k in F]); y1=col(Tr,'out'); y2=col(Te,'out')
    p=H(max_depth=3,learning_rate=0.05,max_iter=200,min_samples_leaf=200,l2_regularization=1.0).fit(X1,y1).predict(X2)
    for th in [0,0.2,0.4]:
        s=np.abs(p)>=th; g=np.sign(p[s])*y2[s]
        if s.sum(): print(f'  {y} |pred|>={th}: n={s.sum():5} right {100*(g>0).mean():.1f}% avg {g.mean():+.3f}% after cost {g.mean()-COST:+.3f}%')
