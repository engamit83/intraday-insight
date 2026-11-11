# MOVE STUDY (owner 11 Nov 10:40): for one stock, every minute of every day 2022-26: did a GOOD MOVE start here?
# GOOD MOVE (written before testing): entering at this minute's close in direction d, price reaches +1.0% in d
#   BEFORE it goes 0.4% against us, by 15:15 (same-minute touch of both = fail, pessimistic).
# Features: only what is known at that minute (no look-ahead). Output: z/move-SYM.npz (one row per minute x direction).
import numpy as np, sys, json, os
SYM, SEC = sys.argv[1], sys.argv[2]
UP, DN = 1.0, 0.4
def load(name):
    T={k:[] for k in 'tohlcv'}
    for y in range(2022,2027):
        f=f'npz{y}/{name}.npz'
        if not os.path.exists(f): continue
        z=np.load(f)
        for k in 'tohlcv': T[k].append(z[k] if k in z.files else np.zeros(len(z['t'])))
    D={k:np.concatenate(v) for k,v in T.items()}
    _,ix=np.unique(D['t'],return_index=True)
    return {k:v[ix].astype(np.float64) for k,v in D.items()}
S=load(SYM); N=load('NIFTY'); X=load(SEC); V=load('INDIAVIX')
def bymin(D):
    return {int(t):i for i,t in enumerate(D['t'])}
Nix, Xix, Vix = bymin(N), bymin(X), bymin(V)
day=(S['t']//1440).astype(int); mod=(S['t']%1440).astype(int)
days=np.unique(day)
rows=[]
dclose={}; dhigh={}; dlow={}
for d in days:
    m=(day==d)&(mod>=555)&(mod<=929)
    if m.sum()<300: continue
    idx=np.nonzero(m)[0]; dclose[d]=S['c'][idx[-1]]; dhigh[d]=S['h'][idx].max(); dlow[d]=S['l'][idx].min()
dl=sorted(dclose)
# same-time 5-min volume profile from the previous 20 days
prof={}
for k,d in enumerate(dl):
    m=(day==d)&(mod>=555)&(mod<=929); idx=np.nonzero(m)[0]
    v=np.zeros(375); v[mod[idx]-555]=S['v'][idx]; prof[d]=np.convolve(v,np.ones(5))[:375]
for k,d in enumerate(dl):
    if k<21: continue
    pd=dl[k-1]; pc=dclose[pd]
    base=np.median(np.array([prof[dl[j]] for j in range(k-20,k)]),axis=0)+1
    m=(day==d)&(mod>=555)&(mod<=929); idx=np.nonzero(m)[0]
    o,h,l,c,v=S['o'][idx],S['h'][idx],S['l'][idx],S['c'][idx],S['v'][idx]; mm=mod[idx]
    op=o[0]; gap=(op/pc-1)*100; prev1=(pc/dclose[dl[k-2]]-1)*100; r5=(pc/dclose[dl[k-6]]-1)*100
    r20=(pc/dclose[dl[k-21]]-1)*100; ph,pl=dhigh[pd],dlow[pd]
    cumv=np.cumsum(v); vwap=np.cumsum(v*(h+l+c)/3)/np.maximum(cumv,1)
    hi=np.maximum.accumulate(h); lo=np.minimum.accumulate(l)
    v5=np.convolve(v,np.ones(5))[:len(v)]
    tt=S['t'][idx].astype(int)
    nc=np.array([N['c'][Nix[t]] if t in Nix else np.nan for t in tt]); xc=np.array([X['c'][Xix[t]] if t in Xix else np.nan for t in tt])
    vx=next((V['o'][Vix[t]] for t in tt if t in Vix),np.nan)
    nop=nc[0]; xop=xc[0]
    end=np.nonzero(mm<=915)[0][-1]
    for i in range(5,len(idx)):
        if mm[i]<560 or mm[i]>885: continue   # 09:20 .. 14:45
        e=c[i]; fh=h[i+1:end+1]; fl=l[i+1:end+1]
        for d_ in (1,-1):
            if d_==1: win=np.nonzero(fh>=e*(1+UP/100))[0]; los=np.nonzero(fl<=e*(1-DN/100))[0]
            else:     win=np.nonzero(fl<=e*(1-UP/100))[0]; los=np.nonzero(fh>=e*(1+DN/100))[0]
            w=win[0] if len(win) else 99999; lz=los[0] if len(los) else 99999
            good=int(w<lz)
            # best move in direction before the stop (how big the move got)
            stop=lz if lz<99999 else len(fh)
            run=((fh[:stop].max()/e-1) if d_==1 else (1-fl[:stop].min()/e))*100 if stop>0 else 0.0
            rows.append((d,mm[i],d_,good,run,
                d_*gap, d_*(c[i]/op-1)*100, d_*(c[i]/c[i-5]-1)*100, d_*(c[i]/c[max(i-15,0)]-1)*100,
                v5[i]/base[mm[i]-555], int(c[i]>hi[i-1]) if d_==1 else int(c[i]<lo[i-1]),
                int(c[i]>ph) if d_==1 else int(c[i]<pl), d_*(c[i]/vwap[i]-1)*100, (hi[i]/lo[i]-1)*100,
                d_*(nc[i]/nc[max(i-15,0)]-1)*100, d_*(nc[i]/nop-1)*100, d_*(xc[i]/xc[max(i-15,0)]-1)*100, d_*(xc[i]/xop-1)*100,
                d_*prev1, d_*r5, d_*r20, vx, (np.datetime64('1970-01-01')+np.timedelta64(int(d),'D')).astype(object).weekday()))
cols=['day','mod','dir','good','run','gap','fromOpen','mom5','mom15','rvol5','brkDay','brkPrev','vwapDist','dayRange',
      'nifty15','niftyOpen','sector15','sectorOpen','prev1','ret5d','ret20d','vix','weekday']
A=np.array(rows,dtype=np.float64)
np.savez_compressed(f'move-{SYM}.npz',A=A,cols=np.array(cols))
print(SYM,'rows',len(A),'days',len(np.unique(A[:,0])),'good minutes',int(A[:,3].sum()), f'({100*A[:,3].mean():.1f}%)')
