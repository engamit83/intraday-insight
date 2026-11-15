# CONFIRMATION-FACTOR STUDY - analysis. PASS MARK (written before results, 15 Nov 14:30):
# A factor survives only if the half chosen on earlier years (by 30-min continuation) beats the other half in EVERY walk-forward test year
# 2024, 2025, 2026 on 30-min AND 15-min continuation, with clean >=1.5% not worse and false breakouts not worse, AND it helps BOTH buys and sells
# in at least 2 of the 3 test years (no sell-bias effect). ~28 factors tried -> also >= 4 of 5 years overall. Outcomes from the entry price.
import json, numpy as np, pandas as pd
R=pd.DataFrame(json.load(open('e3-rows.json'))); R['y']=R.day.str[:4].astype(int)
F=['orRange','orVs20','orPos','first1','upMins','orMove','entryMin','rvol','volBO','volPre5','gap','gapAbs','vsPrevExt','breadth','niftyOR','niftyPre',
   'niftyGap','secPre','secVsNifty','rsOR','vwapDist','prev1','ret5','ret20','weekday','expiry']
OUT=['mv5','mv10','mv15','mv30','mfe30','mae30','falseBO','clean15']
Y=[2022,2023,2024,2025,2026]
print('=== 1+2. DIRECTION RULE (fixed): 09:20 price vs official open. Does it predict? (all BASE entries, from the entry price)')
for y in Y:
    S=R[(R.y==y)&(R.re==0)]
    print(f"  {y}: entries {len(S):5} | side right at 15:14 {100*S.eodRight.mean():5.1f}% (buys {100*S[S.side==1].eodRight.mean():.1f}%, sells {100*S[S.side==-1].eodRight.mean():.1f}%) | "
          f"mean move after entry 5m {S.mv5.mean():+.3f}% 15m {S.mv15.mean():+.3f}% 30m {S.mv30.mean():+.3f}% | false BO {100*S.falseBO.mean():.1f}% | clean>=1.5% {100*S.clean15.mean():.1f}%")
rows=[]
for f in F:
    D=R[R[f].notna()]
    wf=[]; sides=0; allyrs=0
    for ty in [2024,2025,2026]:
        tr=D[D.y<ty]; te=D[D.y==ty]; med=tr[f].median()
        hi=tr[tr[f]>med].mv30.mean(); lo=tr[tr[f]<=med].mv30.mean(); up=hi>lo
        a=te[te[f]>med] if up else te[te[f]<=med]; b=te[te[f]<=med] if up else te[te[f]>med]
        d={k:a[k].mean()-b[k].mean() for k in OUT}
        ok=d['mv30']>0 and d['mv15']>0 and d['clean15']>=0 and d['falseBO']<=0
        sd=[(a[a.side==s].mv30.mean()-b[b.side==s].mv30.mean())>0 for s in (1,-1)]
        sides+=all(sd); wf.append((ok,d,'high' if up else 'low',len(a)))
    tr=D[D.y<=2023]; med=tr[f].median(); up=tr[tr[f]>med].mv30.mean()>tr[tr[f]<=med].mv30.mean()
    for y in Y:
        te=D[D.y==y]; a=te[te[f]>med] if up else te[te[f]<=med]; b=te[te[f]<=med] if up else te[te[f]>med]; allyrs+=a.mv30.mean()>b.mv30.mean()
    passed=all(w[0] for w in wf) and sides>=2 and allyrs>=4
    rows.append((passed,sum(w[0] for w in wf),allyrs,sides,f,wf))
rows.sort(key=lambda r:(r[0],r[1],r[2],r[3]),reverse=True)
print('\n=== 3+4. FACTORS RANKED (walk-forward years passed of 3 | years better of 5 | test years helping BOTH sides of 3)')
for passed,n,ally,sides,f,wf in rows:
    print(f"  {'SURVIVES' if passed else 'reject  '} {f:11} WF {n}/3 | years {ally}/5 | both sides {sides}/3 | better half: {wf[-1][2]:4} | "
          +' '.join(f"{ty}: d30 {w[1]['mv30']:+.3f} d15 {w[1]['mv15']:+.3f} dMFE {w[1]['mfe30']:+.2f} dMAE {w[1]['mae30']:+.2f} dFalseBO {100*w[1]['falseBO']:+.1f} dClean {100*w[1]['clean15']:+.1f}" for ty,w in zip([2024,2025,2026],wf)))
json.dump([[bool(r[0]),r[4],int(r[1]),int(r[2]),int(r[3])] for r in rows],open('e3-rank.json','w'))
