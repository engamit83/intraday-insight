# Same confirmation test on the LIVE TICK DAYS (owner 15 Nov 15:39). BASE entries = replay D0 (= live). Outcomes from the traded price at the entry moment.
import json, numpy as np, pandas as pd
days=['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06','2026-11-09','2026-11-12']
D='/mnt/user-data/uploads/live-feed/data/'
Q=pd.DataFrame(json.load(open('tickq-rows.json'))); C=pd.read_csv('cleanq-tick-D0.csv'); C=C[C.base=='trig'][['day','sym','re','clean']]
out=[]
for day in days:
    J=json.load(open(f'tickdir-{day}.json'))['D0']; P={p['sym']:p for p in J['picks']}
    tf=D+'ticks-2026-11-12.csv' if day=='2026-11-12' else f'tmp/to-{day}.csv'
    df=pd.read_csv(tf,usecols=['time','symbol','price']); df=df[df.symbol.isin({t['sym'] for t in J['trades']})&(df.price>0)&(df.time>='09:15:00')&(df.time<'15:15:00')]
    df['s']=df.time.str.slice(0,2).astype(int)*3600+df.time.str.slice(3,5).astype(int)*60+df.time.str.slice(6).astype(float)
    for t in J['trades']:
        g=df[df.symbol==t['sym']]; s=g.s.to_numpy(); p=g.price.to_numpy(); s0=(t['inTs']/1000+19800)%86400; sg=1 if t['dir']=='BUY' else -1
        k=np.searchsorted(s,s0,side='right')-1; e=p[k]; pk=P[t['sym']]; orh,orl=pk['high'],pk['low']; lvl=orh if sg==1 else orl
        at=lambda sec: p[max(np.searchsorted(s,s0+sec,side='right')-1,0)]
        w=(s>s0)&(s<=s0+1800); seg=p[w]
        back=(s>s0)&(s<=s0+600)
        out.append(dict(day=day,sym=t['sym'],re=t.get('re',0),side=sg,net=t['net'],orRange=(orh/orl-1)*100,gapAbs=abs(t.get('gap') or 0),
            weekday=float(np.datetime64(day).astype(object).weekday()),
            mv5=sg*(at(300)/e-1)*100,mv10=sg*(at(600)/e-1)*100,mv15=sg*(at(900)/e-1)*100,mv30=sg*(at(1800)/e-1)*100,
            mfe30=max(sg*((seg.max() if sg==1 else seg.min())/e-1)*100,0) if len(seg) else 0, mae30=min(sg*((seg.min() if sg==1 else seg.max())/e-1)*100,0) if len(seg) else 0,
            falseBO2=int((sg*(p[back]-lvl)/max(orh-orl,1e-9)<-0.3).any())))
T=pd.DataFrame(out).merge(Q[['day','sym','re','vwapDist','rsOR','niftyVsTwap','secVsNifty','approach','volBO','rvol','entryMin']],on=['day','sym','re'],how='left').merge(C,on=['day','sym','re'],how='left')
O=pd.DataFrame(json.load(open('e3-rows.json'))); O['y']=O.day.str[:4].astype(int)
med={f:O[O.y<=2025][f].median() for f in ['vwapDist','gapAbs','weekday','orRange','rvol','volBO','entryMin','rsOR','secVsNifty']}
med['niftyVsTwap']=0.0; med['approach']=0.30
print(f'TICK DAYS: {len(T)} BASE entries | all: clean {int(T.clean.sum())} ({100*T.clean.mean():.0f}%) falseBO {100*T.falseBO2.mean():.0f}% mv15 {T.mv15.mean():+.2f}% mv30 {T.mv30.mean():+.2f}% net {T.net.sum():+.0f}')
better={'vwapDist':'high','gapAbs':'high','weekday':'high','orRange':'low','rvol':'low','volBO':'high','entryMin':'high','rsOR':'low','secVsNifty':'low','niftyVsTwap':'high','approach':'high'}
for f,hb in better.items():
    a=T[T[f]>med[f]] if hb=='high' else T[T[f]<=med[f]]; b=T.drop(a.index)
    print(f"  {f:11} (old-data better half: {hb:4}, cut {med[f]:.2f}) chosen n {len(a):2}: clean {int(a.clean.sum())}/{len(a)} falseBO {100*a.falseBO2.mean():3.0f}% mv15 {a.mv15.mean():+.2f} mv30 {a.mv30.mean():+.2f} MFE {a.mfe30.mean():+.2f} MAE {a.mae30.mean():+.2f} net {a.net.sum():+6.0f} | other n {len(b):2}: clean {int(b.clean.sum())}/{len(b)} falseBO {100*b.falseBO2.mean():3.0f}% mv30 {b.mv30.mean():+.2f} net {b.net.sum():+6.0f}")
