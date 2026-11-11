# 2% MOVE EVENT STUDY (owner 11 Nov 14:14). For one stock, 2022-26:
# EVENT = a 2% move: entering at a minute's close, price goes >= +2% in the direction BEFORE it goes 0.4% against (by 15:15).
# Consecutive qualifying minutes (same day+direction) = ONE event; its START = the qualifying minute with the best entry price
# (lowest close for up, highest for down) = the turning point. A day can have several events.
# For each event: time, direction, full size (best price reached before the 0.4% stop / 15:15), minutes to reach +2%,
# and FACTORS: (a) just before the start, (b) the day, (c) the days before, (d) during the move (explanation only, not known at entry).
# Baseline: every 5th ordinary minute 09:20-14:45 (not inside an event) with the same factor set, for comparison.
import numpy as np, sys, json, os
SYM, SEC = sys.argv[1], sys.argv[2]; T, STOP = 2.0, float(sys.argv[3]) if len(sys.argv)>3 else 0.4; TAG = sys.argv[4] if len(sys.argv)>4 else ''
NW=json.load(open('fac/news.json')); G=json.load(open('fac/global.json'))
def load(name):
    T_={k:[] for k in 'tohlcv'}
    for y in range(2022,2027):
        f=f'npz{y}/{name}.npz'
        if not os.path.exists(f): continue
        z=np.load(f)
        for k in 'tohlcv': T_[k].append(z[k] if k in z.files else np.zeros(len(z['t'])))
    D={k:np.concatenate(v) for k,v in T_.items()}; _,ix=np.unique(D['t'],return_index=True)
    return {k:v[ix].astype(np.float64) for k,v in D.items()}
S=load(SYM); N=load('NIFTY'); X=load(SEC); V=load('INDIAVIX')
def grid_day(D,d,fill=True):
    t=D['t']; m=(t//1440==d)&(t%1440>=555)&(t%1440<=929); ix=np.nonzero(m)[0]
    if len(ix)==0: return None
    s=(t[ix]%1440-555).astype(int); out={}
    for k in 'ohlc':
        g=np.full(375,np.nan); g[s]=D[k][ix]
        for q in range(375):
            if np.isnan(g[q]) and q>0: g[q]=g[q-1]
        f=np.nonzero(~np.isnan(g))[0][0]; g[:f]=g[f]; out[k]=g
    v=np.zeros(375); v[s]=D['v'][ix]; out['v']=v; out['n']=len(ix); return out
days=[int(d) for d in np.unique((S['t']//1440).astype(int))]
DG={}
for d in days:
    g=grid_day(S,d)
    if g is not None and g['n']>=300: DG[d]=g
dl=sorted(DG); iso=lambda d: str(np.datetime64('1970-01-01')+np.timedelta64(int(d),'D'))
EV=[]; BL=[]
for k,d in enumerate(dl):
    if k<21: continue
    g=DG[d]; o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],g['v']; pdg=DG[dl[k-1]]
    pc=pdg['c'][-1]; ph,pl=pdg['h'].max(),pdg['l'].min()
    closes=[DG[dl[j]]['c'][-1] for j in range(k-21,k)]
    prev1=(closes[-1]/closes[-2]-1)*100; r5=(closes[-1]/closes[-6]-1)*100; r20=(closes[-1]/closes[0]-1)*100
    rng20=np.mean([(DG[dl[j]]['h'].max()/DG[dl[j]]['l'].min()-1)*100 for j in range(k-20,k)])
    vday20=np.mean([DG[dl[j]]['v'].sum() for j in range(k-20,k)])
    prof=np.median(np.array([np.convolve(DG[dl[j]]['v'],np.ones(15))[:375] for j in range(k-20,k)]),axis=0)
    prof=np.maximum(prof,0.25*prof.mean())+1
    v15=np.convolve(v,np.ones(15))[:375]
    op=o[0]; gap=(op/pc-1)*100
    ng=grid_day(N,d); xg=grid_day(X,d); vg=grid_day(V,d)
    nc=ng['c'] if ng else np.full(375,np.nan); xc=xg['c'] if xg else np.full(375,np.nan); vix=vg['o'][0] if vg else np.nan
    cumv=np.cumsum(v); vwap=np.cumsum(v*(h+l+c)/3)/np.maximum(cumv,1); hi=np.maximum.accumulate(h); lo=np.minimum.accumulate(l)
    nw=NW.get(f'{iso(d)}|{SYM}',{}); news=int(bool(nw)); res=int(any(nw.get(q) for q in ('results_filed','results_meeting','board_outcome')))
    gl=G.get(iso(d),{}); spx=gl.get('SP500',np.nan)
    END=360  # 15:15
    # qualify each minute 09:20..14:45
    Q={1:np.zeros(375,bool),-1:np.zeros(375,bool)}; RUN={1:np.zeros(375),-1:np.zeros(375)}; TT={1:np.zeros(375),-1:np.zeros(375)}
    for i in range(5,331):
        e=c[i]
        for dr in (1,-1):
            fav=(h[i+1:END+1]/e-1)*100 if dr==1 else (1-l[i+1:END+1]/e)*100
            adv=(1-l[i+1:END+1]/e)*100 if dr==1 else (h[i+1:END+1]/e-1)*100
            stop=np.nonzero(adv>=STOP)[0]; s_=stop[0] if len(stop) else len(fav)
            win=np.nonzero(fav[:s_]>=T)[0]
            if len(win): Q[dr][i]=True; TT[dr][i]=win[0]+1
            RUN[dr][i]=fav[:s_].max() if s_>0 else 0
    def factors(i,dr):
        lag=lambda n: c[max(i-n,0)]
        return dict(
          time=555+i, gap=dr*gap, fromOpen=dr*(c[i]/op-1)*100,
          before15=dr*(c[i]/lag(15)-1)*100, before30=dr*(c[i]/lag(30)-1)*100,           # + = already moving our way, - = turning
          posInDay=((c[i]-lo[i])/max(hi[i]-lo[i],1e-9)) if dr==1 else ((hi[i]-c[i])/max(hi[i]-lo[i],1e-9)),  # 0 = at the day's extreme AGAINST us (low for a buy)
          rangeSoFar=(hi[i]/lo[i]-1)*100, rangeVs20=(hi[i]/lo[i]-1)*100/max(rng20,0.1),
          vol15x=v15[i]/prof[i], volDayx=cumv[i]/max(vday20*(i+1)/375,1), vwapDist=dr*(c[i]/vwap[i]-1)*100,
          brkDay=int(c[i]>hi[i-1]) if dr==1 else int(c[i]<lo[i-1]), brkPrev=int(c[i]>ph) if dr==1 else int(c[i]<pl),
          nearPrevLevel=int(abs(c[i]/(pl if dr==1 else ph)-1)<0.003),
          nifty15=dr*(nc[i]/nc[max(i-15,0)]-1)*100, niftyOpen=dr*(nc[i]/nc[0]-1)*100, sector15=dr*(xc[i]/xc[max(i-15,0)]-1)*100,
          prev1=dr*prev1, ret5=dr*r5, ret20=dr*r20, rng20=rng20, vix=vix, news=news, results=res, spx=dr*spx,
          niftyDuring=dr*(nc[min(i+int(TT[dr][i] or 30),374)]/nc[i]-1)*100, sectorDuring=dr*(xc[min(i+int(TT[dr][i] or 30),374)]/xc[i]-1)*100)
    used=np.zeros(375,bool)
    for dr in (1,-1):
        q=Q[dr]; i=5; cands=[]
        while i<331:
            if not q[i]: i+=1; continue
            j=i
            while j+1<331 and q[j+1]: j+=1
            seg=np.arange(i,j+1); s=seg[np.argmin(c[seg]*dr)]          # best entry = turning point
            cands.append((s,i,j)); used[i:j+1]=True; i=j+1
        # CHECK-LOOP FIX (11 Nov): one trend must not be counted many times. A later start in the same direction is a NEW move
        # only if it comes after the previous move reached +2% AND the price first pulled back >= 1% from the best price since.
        acc=[]
        for s,i,j in cands:
            if acc:
                s0=acc[-1][0]; t2=s0+int(TT[dr][s0])
                if s<=t2:
                    if (c[s]-c[s0])*dr<0: acc[-1]=(s,acc[-1][1],j)        # better entry inside the same move -> it is the real turn
                    else: acc[-1]=(s0,acc[-1][1],j)
                    continue
                path=c[s0:s+1]; best=np.maximum.accumulate(path) if dr==1 else np.minimum.accumulate(path)
                pull=((best-path)/best*100) if dr==1 else ((path-best)/best*100)
                if pull[t2-s0:].max()<1.0: acc[-1]=(s0,acc[-1][1],j); continue
            acc.append((s,i,j))
        for s,i,j in acc:
            f=factors(s,dr); f.update(day=iso(d),dir=dr,size=RUN[dr][s],mins_to_2pct=TT[dr][s],cluster_len=j-i+1); EV.append(f)
    for i in range(5,331,5):
        if not used[i]:
            for dr in (1,-1):
                f=factors(i,dr); f.update(day=iso(d),dir=dr,size=RUN[dr][i],mins_to_2pct=0,cluster_len=0); BL.append(f)
json.dump({'events':EV,'baseline':BL},open(f'ev2{TAG}-{SYM}.json','w'),default=lambda o: o.item() if hasattr(o,'item') else str(o))
print(SYM,'events',len(EV),'on days',len({e['day'] for e in EV}),'baseline moments',len(BL))
