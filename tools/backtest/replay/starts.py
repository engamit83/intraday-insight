# WHERE DO CLEAN MOVES START? (owner 12 Nov 23:09-23:13, his 11 Nov idea on OUR picked stocks) [TICK]
# Stocks: the BASE 09:20 picks of each tick day (D0 picks). Every 5 s from 09:20 to 14:45, both sides:
#   clean = from the traded price at that moment, >= +1.5% (and +2%) our way before coming back 0.05% against.
# A START = the first moment of a run of clean moments (gap > 60 s ends a run). Factors are measured with data known AT that moment.
# Output: starts-rows.csv (every 5-s moment with factors + outcome) for the comparison 'starts vs ordinary moments'.
import json, numpy as np, pandas as pd, statistics as st
days=['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06','2026-11-09','2026-11-12']
D='/mnt/user-data/uploads/live-feed/data/'
rows=[]
for day in days:
    J=json.load(open(f'tickdir-{day}.json')); picks=[p for p in J['D0']['picks'] or []]
    syms={p['sym'] for p in picks}|{'NIFTY'}
    tf=D+'ticks-2026-11-12.csv' if day=='2026-11-12' else f'tmp/to-{day}.csv'
    df=pd.read_csv(tf,usecols=['time','symbol','price','day_volume']); df=df[df.symbol.isin(syms)&(df.price>0)&(df.time>='09:15:00')&(df.time<'15:15:00')]
    df['s']=df.time.str.slice(0,2).astype(int)*3600+df.time.str.slice(3,5).astype(int)*60+df.time.str.slice(6).astype(float)
    nf=df[df.symbol=='NIFTY']; ns,npx=nf.s.to_numpy(),nf.price.to_numpy()
    def nifty_at(t): k=np.searchsorted(ns,t,side='right')-1; return npx[k] if k>=0 else np.nan
    n_open=npx[0] if len(npx) else np.nan
    for pk in picks:
        g=df[df.symbol==pk['sym']]; s=g.s.to_numpy(); p=g.price.to_numpy(); cv=np.nan_to_num(g.day_volume.to_numpy(float))
        if len(p)<500: continue
        v=np.diff(cv,prepend=cv[0]); v[v<0]=0
        cumv=np.cumsum(v); cumpv=np.cumsum(v*p)
        op=p[0]; orh=p[s<33600].max(); orl=p[s<33600].min(); HI=np.maximum.accumulate(p); LO=np.minimum.accumulate(p)
        grid=np.arange(33600,53100,5)                 # 09:20:00 .. 14:45:00 every 5 s
        idx=np.searchsorted(s,grid,side='right')-1
        # future path per grid point: use ticks after the moment
        for sg in (1,-1):
            fav=None
            for gi,(t,k) in enumerate(zip(grid,idx)):
                if k<0: continue
                e=p[k]; b=w15=w20=10**9; q=k+1
                while q<len(p):                       # scan forward in chunks, stop at the first come-back (fast: usually seconds)
                    f=sg*(p[q:q+1500]/e-1)*100
                    if w15==10**9: x=np.nonzero(f>=1.5)[0]; w15=q+x[0] if len(x) else w15
                    if w20==10**9: x=np.nonzero(f>=2.0)[0]; w20=q+x[0] if len(x) else w20
                    x=np.nonzero(f<=-0.05)[0]
                    if len(x): b=q+x[0]; break
                    q+=1500
                hi=HI[k]; lo=LO[k]
                vw=cumpv[k]/cumv[k] if cumv[k]>0 else e
                def pxago(sec): j=np.searchsorted(s,t-sec,side='right')-1; return p[j] if j>=0 else p[0]
                def volwin(a,b_): ja=np.searchsorted(s,t-a,side='right')-1; jb=np.searchsorted(s,t-b_,side='right')-1; return cumv[max(jb,0)]-cumv[max(ja,0)]
                v1=volwin(60,0); v15=volwin(900,0)/15 if t-33300>900 else volwin(t-33300,0)/max((t-33300)/60,1)
                nn=nifty_at(t); n15=nifty_at(t-900)
                rows.append(dict(day=day,sym=pk['sym'],pickDir=1 if pk['dir']=='BUY' else -1,side=sg,t=int(t),
                    c15=int(w15<b),c20=int(w20<b),
                    withPick=int(sg==(1 if pk['dir']=='BUY' else -1)),
                    fromOpen=sg*(e/op-1)*100, vwapDist=sg*(e/vw-1)*100,
                    posInDay=((e-lo)/max(hi-lo,1e-9)) if sg==1 else ((hi-e)/max(hi-lo,1e-9)),
                    mom1=sg*(e/pxago(60)-1)*100, mom5=sg*(e/pxago(300)-1)*100, mom15=sg*(e/pxago(900)-1)*100,
                    pullback=sg*(e/(hi if sg==1 else lo)-1)*100,      # 0 = at the day extreme our way, negative = below the high (buy)
                    vol1x=v1/max(v15,1), beyondOR=int(e>orh) if sg==1 else int(e<orl),
                    nifty15=sg*(nn/n15-1)*100 if nn==nn and n15==n15 else np.nan, niftyOpen=sg*(nn/n_open-1)*100 if nn==nn else np.nan))
    print(day,'rows',len(rows),flush=True)
R=pd.DataFrame(rows)
# mark STARTS: first clean moment of each run (per stock, side); runs end after a >60 s gap
R=R.sort_values(['day','sym','side','t']).reset_index(drop=True)
R['start']=0
for (d,sy,sd),g in R.groupby(['day','sym','side']):
    c=g[g.c15==1].t.to_numpy(); ix=g[g.c15==1].index.to_numpy()
    if len(c): R.loc[ix[np.r_[True,np.diff(c)>60]],'start']=1
R.to_csv('starts-rows.csv',index=False)
print('moments',len(R),'clean moments',int(R.c15.sum()),'STARTS',int(R.start.sum()),'stock-days',R.groupby(['day','sym']).ngroups)
