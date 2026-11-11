# MOVE STUDY v2 (audit, owner 11 Nov 10:52). Owner's intent: for this stock, on all days 2022-26: how many good moves, WHEN they start,
# and WHICH factors (at that minute, before it in the day, and on the days before) favoured them -> to improve our ENTRY.
# Fixes vs v1: (1) realistic trade result: +1% target / -0.4% stop / else exit 15:15 close; (2) one signal per day+direction
# (consecutive minutes are the same opportunity - no double counting); (3) news + global-night factors added.
# PASS MARK (written before looking): an entry condition is useful if, using only its FIRST signal per day+direction,
# the average trade after 0.146% costs is > 0 in BOTH 2022-24 and 2025-26 with >= 60 trades in each.
import numpy as np, sys, json
SYM=sys.argv[1]; z=np.load(f'move-{SYM}.npz'); A=z['A']; C=list(z['cols']); col=lambda k: A[:,C.index(k)]
NW=json.load(open('fac/news.json')); G=json.load(open('fac/global.json')); COST=0.146
dayv=col('day').astype(int); iso=np.array([str(np.datetime64('1970-01-01')+np.timedelta64(int(d),'D')) for d in np.unique(dayv)])
isomap=dict(zip(np.unique(dayv),iso))
yr=np.array([int(isomap[d][:4]) for d in dayv]); P1=yr<=2024; P2=yr>=2025
g=col('good'); tr=col('trade'); mod=col('mod'); dr=col('dir')
news=np.array([1.0 if NW.get(f'{isomap[d]}|{SYM}') else 0.0 for d in dayv])
res=np.array([1.0 if any(NW.get(f'{isomap[d]}|{SYM}',{}).get(k) for k in ('results_filed','results_meeting','board_outcome')) else 0.0 for d in dayv])
spx=np.array([G.get(isomap[d],{}).get('SP500',np.nan) for d in dayv])*dr
asia=np.array([np.nanmean([G.get(isomap[d],{}).get(k,np.nan) for k in ('NIKKEI','HANGSENG','KOSPI')]) for d in dayv])*dr
print(f'===== {SYM} (old data - hint only) =====')
# A) how many good moves, when, how big
key=dayv*10+dr+1; order=np.lexsort((mod,key)); st=np.zeros(len(A),bool); pk=None; pg=0; pm=-9
for i in order:
    st[i]= g[i]==1 and not (key[i]==pk and pg==1 and mod[i]==pm+1); pk,pg,pm=key[i],g[i],mod[i]
print('A) GOOD MOVES (+1% before -0.4%), counted once per run')
for y in range(2022,2027):
    m=yr==y; nd=len(np.unique(dayv[m]))
    print(f'   {y}: {nd} days; days with an up move {len(np.unique(dayv[m&st&(dr==1)]))}, down {len(np.unique(dayv[m&st&(dr==-1)]))}; median size of the run {np.median(col("run")[m&st]):.2f}%')
print('   start time:', ' '.join(f'{h:02d}h:{100*np.mean((mod[st]//60)==h):.0f}%' for h in range(9,15)))
# B) what was present at good-move starts vs at ordinary minutes
conds={'early 09:20-10:25':mod<=625,'breaks day high/low (our way)':col('brkDay')==1,'last 15 min moving our way':col('mom15')>0.1,
 'above VWAP (buy) / below (sell)':col('vwapDist')>0,'volume >1.5x normal':col('rvol5')>=1.5,'Nifty last 15 min our way':col('nifty15')>0.03,
 'sector last 15 min our way':col('sector15')>0.03,'gap our way':col('gap')>0.2,'yesterday moved our way':col('prev1')>0.5,
 'news/filing that day':news==1,'results/board that day':res==1,'US market last night our way':spx>0.3,'Asia this morning our way':asia>0.3,'VIX >= 16':col('vix')>=16}
print('\nB) HOW OFTEN each factor was present: at good-move STARTS vs at all other minutes (2022-24 | 2025-26)')
for k,m in conds.items():
    a1=100*m[st&P1].mean(); b1=100*m[~st&P1].mean(); a2=100*m[st&P2].mean(); b2=100*m[~st&P2].mean()
    print(f'   {k:34} starts {a1:4.0f}% vs others {b1:4.0f}%  |  {a2:4.0f}% vs {b2:4.0f}%   {"<- favours" if a1>b1*1.2 and a2>b2*1.2 else ""}')
# C) entry conditions, first signal per day+direction, realistic trade result
def first_signal(m):
    out=[]
    for P in (P1,P2):
        ix=np.nonzero(m&P)[0]; seen=set(); r=[]
        for i in ix[np.argsort(dayv[ix]*2000+mod[ix])]:
            k=(dayv[i],dr[i])
            if k in seen: continue
            seen.add(k); r.append(tr[i]-COST)
        out.append(np.array(r))
    return out
E=mod<=625; B=col('brkDay')==1; M=(col('mom15')>0.1)&(col('vwapDist')>0); V=col('rvol5')>=1.5; N=col('nifty15')>0.03
rules={'R0 any minute (reference)':np.ones(len(A),bool),'E1 breaks day high/low':B,'E2 = E1 + early (<=10:25)':B&E,'E3 = E2 + momentum & VWAP our way':B&E&M,
 'E4 = E3 + volume >1.5x':B&E&M&V,'E5 = E4 + Nifty our way':B&E&M&V&N,'E6 = E3 + Nifty our way':B&E&M&N}
print('\nC) ENTRY RULES - first signal per day and direction, trade = +1% target / -0.4% stop / else 15:15 close, after costs')
print('   rule                                   2022-24: trades  win%  avg%  |  2025-26: trades  win%  avg%   pass?')
for k,m in rules.items():
    r1,r2=first_signal(m)
    ok=len(r1)>=60 and len(r2)>=60 and r1.mean()>0 and r2.mean()>0
    print(f'   {k:38} {len(r1):7} {100*(r1>0).mean():5.0f} {r1.mean():+6.3f}  | {len(r2):7} {100*(r2>0).mean():5.0f} {r2.mean():+6.3f}   {"PASS" if ok else "-"}')
