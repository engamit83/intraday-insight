# E1 on the LIVE TICK DAYS (decides entry timing, rule 0w). Entry = traded price at 09:20:00 + 0.02% slip (ask/bid not used: same basis as BASE check).
import json, numpy as np, pandas as pd
days=['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06','2026-11-09','2026-11-12']
D='/mnt/user-data/uploads/live-feed/data/'; rows=[]
for day in days:
    J=json.load(open(f'tickdir-{day}.json'))['D0']; P=J['picks']
    tf=D+'ticks-2026-11-12.csv' if day=='2026-11-12' else f'tmp/to-{day}.csv'
    df=pd.read_csv(tf,usecols=['time','symbol','price','day_volume']); df=df[df.symbol.isin({p['sym'] for p in P})&(df.price>0)&(df.time>='09:15:00')&(df.time<'15:15:00')]
    df['s']=df.time.str.slice(0,2).astype(int)*3600+df.time.str.slice(3,5).astype(int)*60+df.time.str.slice(6).astype(float)
    for p in P:
        g=df[df.symbol==p['sym']]; s=g.s.to_numpy(); px=g.price.to_numpy(); cv=np.nan_to_num(g.day_volume.to_numpy(float))
        sg=1 if p['dir']=='BUY' else -1; k=np.searchsorted(s,33600,side='right')-1
        if k<1: continue
        dv=np.diff(cv[:k+1],prepend=cv[0]); dv[dv<0]=0; vw=(px[:k+1]*dv).sum()/dv.sum() if dv.sum()>0 else px[k]
        e=px[k]*(1+sg*0.0002); vd=sg*(px[k]/vw-1)*100; gapUp=-p['gapWith'] if (sg==-1 and p.get('gapWith') is not None) else None
        f=sg*(px[k+1:]/e-1)*100; b=np.nonzero(f<=-0.05)[0]; b=b[0] if len(b) else 10**9
        c15=int((np.nonzero(f>=1.5)[0][:1].tolist() or [10**9])[0]<b); c20=int((np.nonzero(f>=2.0)[0][:1].tolist() or [10**9])[0]<b)
        rows.append(dict(day=day,sym=p['sym'],side=sg,confGap=int(gapUp is not None and gapUp>1),confVw=int(vd>=0.84),c15=c15,c20=c20))
R=pd.DataFrame(rows)
for nm,S in [('all picks at 09:20',R),('E1a gap-up sells',R[R.confGap==1]),('E1b VWAP >=0.84%',R[R.confVw==1]),('E1 either',R[(R.confGap==1)|(R.confVw==1)])]:
    print(f'{nm:20} n {len(S):3} clean1.5 {int(S.c15.sum())} ({100*S.c15.mean():.0f}%) clean2 {int(S.c20.sum())}')
print('BASE breakout entries on the same days: 7 of 53 clean1.5 (13%)')
