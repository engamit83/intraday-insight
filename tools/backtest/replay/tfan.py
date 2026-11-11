# LIVE-TICK RULE TEST, all stocks, 9 tick days. BUILD = first 5 days (22,23,26,27,28 Oct), CHECK = last 4 (29,30 Oct, 6,9 Nov) never seen.
# Trade per rule: first signal per stock per day -> +2% target / 0.5% stop / 15:15, costs 0.146%.
# PASS MARK (written first): avg after costs > 0 on build AND check, >= 100 trades each, and >= 3 of the 4 check days positive.
import pandas as pd, numpy as np, glob
D=pd.concat([pd.read_pickle(f) for f in sorted(glob.glob('tf-*.pkl'))],ignore_index=True)
D['tr']=D['tr']-0.146; B=D.day<'2026-10-29'; K=~B
F=['of5','of15','ofDay','bookImb','spread','mom15','fromOpen','posInDay','vol15rel','rangeSoFar','time']
print(f'rows {len(D)}, stock-days {D.groupby(["day","sym"]).ngroups}; clean-2% minutes build {100*D.clean[B].mean():.2f}% check {100*D.clean[K].mean():.2f}%')
print('\n1) EACH FACTOR ALONE: clean-2% rate by fifth (thresholds from build days), build | check')
conds=[]
for f in F:
    qs=D.loc[B,f].quantile([0,.2,.4,.6,.8,1]).to_numpy(); s=f'  {f:10}'
    for a,b in zip(qs[:-1],qs[1:]):
        m=(D[f]>=a)&(D[f]<=b); s+=f' [{a:.3g}..{b:.3g}] {100*D.clean[m&B].mean():.2f}|{100*D.clean[m&K].mean():.2f}'
    print(s)
    for q in (0.2,0.4,0.6,0.8):
        t=D.loc[B,f].quantile(q); conds.append((f'{f}>={t:.3g}',(D[f]>=t).to_numpy())); conds.append((f'{f}<={t:.3g}',(D[f]<=t).to_numpy()))
conds+= [('buy',(D.dir==1).to_numpy()),('sell',(D.dir==-1).to_numpy())]
key=(D.day+'|'+D.sym).to_numpy(); tr=D.tr.to_numpy(); Bn=B.to_numpy(); Kn=K.to_numpy(); dayv=D.day.to_numpy()
order=np.lexsort((D.time.to_numpy(),key))
def first(m):
    ix=order[m[order]]
    if len(ix)==0: return ix
    _,f=np.unique(key[ix],return_index=True); return ix[f]
def sc(m):
    f=first(m); return f
beam=[((),np.ones(len(D),bool))]; tried=0; res=[]
CD=dict(conds)
for depth in range(3):
    cand=[]
    for names,m in beam:
        for n,c in conds:
            if n in names: continue
            tried+=1; f=first(m&c&Bn)
            if len(f)>=150: cand.append((tr[f].mean(),names+(n,)))
    cand.sort(key=lambda t:-t[0]); beam=[]; seen=set()
    for s,names in cand:
        k=tuple(sorted(names))
        if k in seen: continue
        seen.add(k); mm=np.ones(len(D),bool)
        for q in names: mm&=CD[q]
        beam.append((names,mm)); res.append((s,names))
        if len(beam)>=20: break
print(f'\n2) RULES ({tried} variants tried, built on 5 days, checked on 4 unseen days):')
res.sort(key=lambda t:-t[0])
for s,names in res[:12]:
    mm=np.ones(len(D),bool)
    for q in names: mm&=CD[q]
    fb=first(mm&Bn); fk=first(mm&Kn)
    per=[tr[fk][dayv[fk]==d].sum() for d in ['2026-10-29','2026-10-30','2026-11-06','2026-11-09']]
    ok=len(fb)>=100 and len(fk)>=100 and tr[fb].mean()>0 and tr[fk].mean()>0 and sum(x>0 for x in per)>=3
    print(f'  {"PASS" if ok else " -  "} {" AND ".join(names)}\n       build {len(fb)} trades avg {tr[fb].mean():+.3f}% win {100*np.mean(tr[fb]>0):.0f}% | check {len(fk)} trades avg {tr[fk].mean():+.3f}% win {100*np.mean(tr[fk]>0):.0f}% | check days total %: {" ".join(f"{x:+.0f}" for x in per)}')
# 3) the 2 stocks: order flow at their clean-move minutes vs their other minutes
print('\n3) BAJFINANCE / ANGELONE on live days: order flow when a clean 2% move followed vs other minutes (median)')
for s in ['BAJFINANCE','ANGELONE']:
    x=D[D.sym==s]
    for f in ['of5','of15','ofDay','bookImb','vol15rel','mom15','posInDay']:
        print(f'   {s:10} {f:9} moves {x.loc[x.clean==1,f].median():+.3f} (n {int(x.clean.sum())}) vs other {x.loc[x.clean==0,f].median():+.3f}')
