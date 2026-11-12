# DIRECTION STUDY analysis. PASS MARK (written before results, 13 Nov 00:20):
# a side rule passes only if, in EVERY walk-forward test year (2024, 2025, 2026), it is right at end of day >= 55% AND its clean >=1.5%
# rate on the chosen side is clearly above the current rule's (>= 1.3x), on picks it actually trades (>= 30% of picks kept).
# Then it must also hold on the live tick days before any shadow.
import json, numpy as np, pandas as pd, warnings; warnings.filterwarnings('ignore')
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import HistGradientBoostingClassifier
R=pd.DataFrame(json.load(open('dirfac-rows.json'))); R['y']=R.day.str[:4].astype(int)
R=R[R.eod!=0].copy()
F=['gap','orMove','orPos','orRange','orVsNifty','secOr','prev1','ret5','ret20','prevPos','vsPrevHigh','vsPrevLow','first1','last2','upMins',
   'nGap','nOr','nPrev','breadth','vix','vixOr','spx','nasdaq','dax','usvix','expiry','weekday','rvol']
def score(S,side):
    side=np.asarray(side); m=side!=0; S=S[m]; side=side[m]
    right=(np.sign(S.mv)==side).mean(); clean=np.where(side==1,S.up,S.dn).mean()
    return len(S),100*right,100*clean
YRS=[2022,2023,2024,2025,2026]
print('rows',len(R),'| share clean up',round(100*R.up.mean(),1),'down',round(100*R.dn.mean(),1),'| either',round(100*((R.up+R.dn)>0).mean(),1))
print('\nCURRENT RULE (09:20 vs open):');
for y in YRS: n,a,c=score(R[R.y==y],R[R.y==y].pickDir); print(f'  {y}: n {n} right {a:.1f}% clean on side {c:.1f}%')
print('\nSINGLE FACTORS (side = sign of factor; FADE = opposite). right% per year | clean% per year')
out=[]
for f in F:
    if f in ('expiry','weekday','vix','upMins','orPos','orRange','prevPos','rvol'): continue
    for fade in (1,-1):
        s=[];
        for y in YRS:
            S=R[(R.y==y)&R[f].notna()]; n,a,c=score(S,fade*np.sign(S[f]))
            s.append((a,c))
        out.append((min(a for a,_ in s),f,'FADE' if fade<0 else 'follow',s))
for mn,f,k,s in sorted(out,reverse=True)[:14]:
    print(f"  {f:11} {k:6} right {' '.join(f'{a:4.1f}' for a,_ in s)} | clean {' '.join(f'{c:4.1f}' for _,c in s)}")
print('\nWALK-FORWARD MODELS (train on all earlier years, test on the next; side = model; "confident" = top 30% by model certainty)')
X=R[F].astype(float)
for name,mk in [('logistic',lambda: LogisticRegression(C=0.1,max_iter=2000)),('boosted trees',lambda: HistGradientBoostingClassifier(max_depth=3,max_iter=150,learning_rate=0.05))]:
    for ty in [2024,2025,2026]:
        tr=R.y<ty; te=R.y==ty
        mu=X[tr].mean(); sd=X[tr].std()+1e-9; Xt=((X-mu)/sd).fillna(0)
        m=mk().fit(Xt[tr],(R.mv[tr]>0).astype(int)); pr=m.predict_proba(Xt[te])[:,1]
        side=np.where(pr>0.5,1,-1); n,a,c=score(R[te],side)
        conf=np.abs(pr-0.5); cut=np.quantile(conf,0.7); sd2=np.where(conf>=cut,side,0); n2,a2,c2=score(R[te],sd2)
        n0,a0,c0=score(R[te],R[te].pickDir)
        print(f"  {name:14} test {ty}: all picks right {a:4.1f}% clean {c:4.1f}% | confident 30%: right {a2:4.1f}% clean {c2:4.1f}% (n {n2}) | current rule right {a0:4.1f}% clean {c0:4.1f}%")
