# FACTOR DATASET v3 (owner 11 Nov 16:36): every minute 09:20-14:45, both directions, ALL factors (owner's + Claude's), known at that minute.
# Outcomes: clean = >=+2% before a 0.05% dip below entry; tr = trade result % with target +2%, stop 0.5%, else 15:15 close (before costs).
import numpy as np, sys, json, os, csv, collections as C
SYM, SEC, P1, P2 = sys.argv[1:5]; START=int(sys.argv[5]) if len(sys.argv)>5 else 5; OUT=sys.argv[6] if len(sys.argv)>6 else f'f3-{SYM}.npz'
NW=json.load(open('fac/news.json')); G=json.load(open('fac/global.json')); L=json.load(open('labels920.json'))
def load(name):
    T={k:[] for k in 'tohlcv'}
    for y in range(2021,2027):
        f=f'npz{y}/{name}.npz'
        if not os.path.exists(f): continue
        z=np.load(f)
        for k in 'tohlcv': T[k].append(z[k] if k in z.files else np.zeros(len(z['t'])))
    D={k:np.concatenate(v) for k,v in T.items()}; _,ix=np.unique(D['t'],return_index=True); return {k:v[ix].astype(np.float64) for k,v in D.items()}
def grids(D):
    out={}; day=(D['t']//1440).astype(int); mod=(D['t']%1440).astype(int)
    for d in np.unique(day):
        m=(day==d)&(mod>=555)&(mod<=929); ix=np.nonzero(m)[0]
        if len(ix)<200: continue
        s=mod[ix]-555; g={}
        for k in 'ohlc':
            a=np.full(375,np.nan); a[s]=D[k][ix]
            for q in range(1,375):
                if np.isnan(a[q]): a[q]=a[q-1]
            f=np.nonzero(~np.isnan(a))[0][0]; a[:f]=a[f]; g[k]=a
        v=np.zeros(375); v[s]=D['v'][ix]; g['v']=v; g['n']=len(ix); out[int(d)]=g
    return out
_S=load(SYM)
# Tata Motors demerger (14 Oct 2025): Zerodha back-adjusted the old prices by 0.6918 (457.1/660.75), but the NSE price discovery base
# was 400.00 (bhav open) = factor 0.6054 -> Zerodha shows a fake -13.6% day. Fix: scale pre-demerger prices by 0.6054/0.6918.
if os.environ.get('ADJ'):
    _s,_d,_f=os.environ['ADJ'].split(':'); _cut=int((np.datetime64(_d)-np.datetime64('1970-01-01')).astype(int))*1440
    if _s==SYM:
        _m=_S['t']<_cut
        for _k in 'ohlc': _S[_k][_m]*=float(_f)
S=grids(_S); N=grids(load('NIFTY')); X=grids(load(SEC)); V=grids(load('INDIAVIX')); PA=grids(load(P1)); PB=grids(load(P2))
DEL={}
for r in csv.reader(open('/mnt/user-data/uploads/live-feed/data/history-news/bhav-compact.csv')):
    if r[1]==SYM and r[0]>='2021-10-01':
        try: DEL[r[0]]=float(r[5])
        except: pass
iso=lambda d: str(np.datetime64('1970-01-01')+np.timedelta64(int(d),'D'))
SKIPD=set(os.environ.get('SKIP_DAYS','').split(','))  # e.g. Tata Motors demerger days
dl=sorted(d for d,g in S.items() if g['n']>=300)
dl=[d for d in dl if iso(d)>='2021-11-01']
rows=[]
for k,d in enumerate(dl):
    if iso(d)<'2022-01-01' or k<60 or iso(d) in SKIPD: continue
    g=S[d]; o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],g['v']; pg=S[dl[k-1]]
    pc=pg['c'][-1]; ph,pl=pg['h'].max(),pg['l'].min()
    cl=[S[dl[j]]['c'][-1] for j in range(k-60,k)]
    prev1=(cl[-1]/cl[-2]-1)*100; r5=(cl[-1]/cl[-6]-1)*100; r20=(cl[-1]/cl[-21]-1)*100
    rng20=np.mean([(S[dl[j]]['h'].max()/S[dl[j]]['l'].min()-1)*100 for j in range(k-20,k)])
    h20=max(S[dl[j]]['h'].max() for j in range(k-20,k)); l20=min(S[dl[j]]['l'].min() for j in range(k-20,k))
    h60=max(S[dl[j]]['h'].max() for j in range(k-60,k)); l60=min(S[dl[j]]['l'].min() for j in range(k-60,k))
    ppg=S[dl[k-2]]; inside=int(ph<=ppg['h'].max() and pl>=ppg['l'].min())
    prevRng=(ph/pl-1)*100; pcpos=(pc-pl)/max(ph-pl,1e-9)
    vday20=np.mean([S[dl[j]]['v'].sum() for j in range(k-20,k)])
    prof=np.median(np.array([np.convolve(S[dl[j]]['v'],np.ones(15))[:375] for j in range(k-20,k)]),axis=0); prof=np.maximum(prof,0.25*prof.mean())+1
    cumprof=np.median(np.array([np.cumsum(S[dl[j]]['v']) for j in range(k-20,k)]),axis=0)+1
    v15=np.convolve(v,np.ones(15))[:375]; cumv=np.cumsum(v); vwap=np.cumsum(v*(h+l+c)/3)/np.maximum(cumv,1)
    hi=np.maximum.accumulate(h); lo=np.minimum.accumulate(l); op=o[0]; gap=(op/pc-1)*100
    or5h,or5l=h[:5].max(),l[:5].min(); or15h,or15l=h[:15].max(),l[:15].min()
    def gc(D):
        x=D.get(d); return x['c'] if x is not None else np.full(375,np.nan)
    nc,xc,pa,pb,vx=gc(N),gc(X),gc(PA),gc(PB),gc(V)
    ds=iso(d); nw=NW.get(f'{ds}|{SYM}',{}); news=int(bool(nw)); res=int(any(nw.get(q) for q in ('results_filed','results_meeting','board_outcome')))
    gl=G.get(ds,{}); spx=gl.get('SP500',np.nan); asia=np.nanmean([gl.get(q,np.nan) for q in ('NIKKEI','HANGSENG','KOSPI')]) if gl else np.nan
    lb=L.get(ds,{}); expiry=int(bool(lb.get('expiry'))); mexp=int(bool(lb.get('monthly_expiry')))
    monthEnd=int(k+3<len(dl) and iso(dl[k+3])[5:7]!=ds[5:7]) if k+3<len(dl) else 0
    deliv=DEL.get(iso(dl[k-1]),np.nan); step=10 if c[0]<1000 else 50
    # minute index of the day extreme (low and high) so far, and volume on that minute
    argl=np.zeros(375,int); argh=np.zeros(375,int)
    for i in range(1,375):
        argl[i]=i if l[i]<=l[argl[i-1]] else argl[i-1]; argh[i]=i if h[i]>=h[argh[i-1]] else argh[i-1]
    mv=np.maximum(np.array([np.median(v[:i+1]) for i in range(375)]),1)
    for i in range(START,331):   # rule 0l: from 09:16 (i=1) when START=1; 09:20 (i=5) originally
        e=c[i]
        for dr in (1,-1):
            # outcomes
            fav=(h[i+1:361]/e-1)*100 if dr==1 else (1-l[i+1:361]/e)*100
            adv=(1-l[i+1:361]/e)*100 if dr==1 else (h[i+1:361]/e-1)*100
            s05=np.nonzero(adv>=0.05)[0]; s05=s05[0] if len(s05) else 999
            w=np.nonzero(fav>=2.0)[0]; w=w[0] if len(w) else 999
            clean=int(w<s05)
            w15=np.nonzero(fav>=1.5)[0]; w15=w15[0] if len(w15) else 999; clean15=int(w15<s05)   # owner 12 Nov 00:43: 1.5-2% clean
            s5=np.nonzero(adv>=0.5)[0]; s5=s5[0] if len(s5) else 999
            tr=2.0 if w<s5 else (-0.5 if s5<999 else (c[360]/e-1)*100*dr)
            ex=argl[i] if dr==1 else argh[i]; extp=l[ex] if dr==1 else h[ex]
            sgn=lambda a,b: dr*(a/b-1)*100
            rows.append([d,555+i,dr,clean,tr,clean15,
              sgn(e,c[max(i-3,0)]),sgn(e,c[max(i-15,0)]),sgn(e,c[max(i-30,0)]),sgn(e,op),dr*gap,
              ((e-lo[i])/max(hi[i]-lo[i],1e-9)) if dr==1 else ((hi[i]-e)/max(hi[i]-lo[i],1e-9)),
              (hi[i]/lo[i]-1)*100/max(rng20,0.1), v15[i]/prof[i], cumv[i]/cumprof[i], sgn(e,vwap[i]),
              int(i>0 and sgn(e,vwap[i])>0 and min(sgn(c[q],vwap[q]) for q in range(max(i-15,0),i))<0),
              int(dr*gap<-0.2 and sgn(e,pc)>=0), sgn(e,pc),
              (h[:min(i+1,5)].max()/l[:min(i+1,5)].min()-1)*100,(h[:min(i+1,15)].max()/l[:min(i+1,15)].min()-1)*100,  # or5/or15 without look-ahead before 09:20/09:30
              int(i>=15 and (e>or15h if dr==1 else e<or15l)),
              i-ex, abs(e/extp-1)*100, v[ex]/mv[i],
              int(i-ex>=10 and ((l[max(ex+5,0):i+1].min()>extp*1.001) if dr==1 else (h[max(ex+5,0):i+1].max()<extp*0.999))),
              min(abs(e-np.round(e/step)*step)/e*100,9),
              ((e-l20)/max(h20-l20,1e-9)) if dr==1 else ((h20-e)/max(h20-l20,1e-9)),
              ((e-l60)/max(h60-l60,1e-9)) if dr==1 else ((h60-e)/max(h60-l60,1e-9)),
              sgn(e,op)-sgn(nc[i],nc[0]), sgn(nc[i],nc[max(i-15,0)]), sgn(nc[i],nc[0]), sgn(xc[i],xc[max(i-15,0)]), sgn(xc[i],xc[0]),
              np.nanmean([sgn(pa[i],pa[max(i-15,0)]),sgn(pb[i],pb[max(i-15,0)])]), np.nanmean([sgn(pa[i],pa[0]),sgn(pb[i],pb[0])]),
              vx[0], (vx[i]/vx[0]-1)*100 if vx[0]==vx[0] else np.nan,
              pcpos if dr==1 else 1-pcpos, prevRng, inside, deliv, dr*prev1, dr*r5, dr*r20, rng20,
              np.datetime64(ds).astype(object).weekday(), expiry, mexp, monthEnd, news, res, dr*spx, dr*asia])
cols=['day','time','dir','clean','tr','clean15','mom3','mom15','mom30','fromOpen','gap','posInDay','rangeVs20','vol15x','volDayx','vwapDist','vwapReclaim',
 'gapFill','vsPrevClose','or5','or15','brkOR15','minsSinceExt','distFromExt','climaxVol','higherLow','roundDist','pos20d','pos60d','relStr',
 'nifty15','niftyOpen','sector15','sectorOpen','peer15','peerOpen','vix','vixChg','prevClosePos','prevRange','insideDay','prevDeliv','prev1','ret5','ret20',
 'rng20','weekday','expiry','monthExpiry','monthEnd','news','results','spx','asia']
assert len(rows[0])==len(cols), f'row width {len(rows[0])} != {len(cols)} columns'  # check-loop fix 12 Nov: a shifted column must never pass silently
A=np.array(rows,dtype=np.float64); np.savez_compressed(OUT,A=A,cols=np.array(cols))
print(SYM,'rows',len(A),'days',len(np.unique(A[:,0])),'clean 2% minutes',int(A[:,3].sum()))
