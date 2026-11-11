# R3 SUPPORT FACTORS (owner 11 Nov 23:00). R3 stock-day = a 09:20 pick (replay S-RAW) whose 5-day rise >= 7.6%.
# For every minute 09:20-14:45 of each R3 stock-day: SELL-side factors known at that minute + outcomes:
#   clean = price falls >= 2% from entry WITHOUT ever going above the sell price (0.05% tolerance), by 15:15
#   tr    = sell trade: target -2%, stop +0.5%, else 15:15 (before costs)
import numpy as np, json, os, collections as C
import sys
DR=-1 if len(sys.argv)>1 and sys.argv[1]=='buy' else 1   # 1 = sell study (R3), -1 = buy study (mirror: 5-day fall >= 7.6%)
R=[r for r in json.load(open('s2rows.json')) if (r['ret5']>=7.6 if DR==1 else r['ret5']<=-7.6)]
NW=json.load(open('fac/news.json')); L=json.load(open('labels920.json'))
DEL=C.defaultdict(dict)
import csv
syms={r['sym'] for r in R}
for row in csv.reader(open('/mnt/user-data/uploads/live-feed/data/history-news/bhav-compact.csv')):
    if row[1] in syms and row[0]>='2021-12-01':
        try: DEL[row[1]][row[0]]=float(row[5])
        except: pass
def load(name):
    T={k:[] for k in 'tohlcv'}
    for y in range(2022,2027):
        f=f'npz{y}/{name}.npz'
        if not os.path.exists(f): continue
        z=np.load(f)
        for k in 'tohlcv': T[k].append(z[k])
    if not T['t']: return None
    D={k:np.concatenate(v).astype(float) for k,v in T.items()}; _,ix=np.unique(D['t'],return_index=True); return {k:v[ix] for k,v in D.items()}
def grid(D,d):
    t=D['t']; m=(t//1440==d)&(t%1440>=555)&(t%1440<=929); ix=np.nonzero(m)[0]
    if len(ix)<150: return None
    s=(t[ix]%1440-555).astype(int); g={}
    for k in 'ohlc':
        a=np.full(375,np.nan); a[s]=D[k][ix]
        for q in range(1,375):
            if np.isnan(a[q]): a[q]=a[q-1]
        f=np.nonzero(~np.isnan(a))[0][0]; a[:f]=a[f]; g[k]=a
    v=np.zeros(375); v[s]=D['v'][ix]; g['v']=v; return g
NIF=load('NIFTY')
iso=lambda d: str(np.datetime64('1970-01-01')+np.timedelta64(int(d),'D'))
dn=lambda s: int((np.datetime64(s)-np.datetime64('1970-01-01')).astype(int))
by=C.defaultdict(list)
for r in R: by[r['sym']].append(r)
rows=[]; SD=0
for sym,lst in by.items():
    S=load(sym)
    if S is None: continue
    alld=sorted({int(x) for x in np.unique(S['t']//1440)})
    for r in lst:
        d=dn(r['day']); g=grid(S,d); ng=grid(NIF,d)
        if g is None or d not in alld: continue
        k=alld.index(d)
        if k<21: continue
        prev=[grid(S,alld[j]) for j in range(k-20,k)]; prev=[p for p in prev if p is not None]
        if len(prev)<15: continue
        o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],g['v']; pc=prev[-1]['c'][-1]; op=o[0]
        prof=np.median(np.array([np.convolve(p['v'],np.ones(15))[:375] for p in prev]),axis=0); prof=np.maximum(prof,0.25*prof.mean())+1
        cumprof=np.median(np.array([np.cumsum(p['v']) for p in prev]),axis=0)+1
        v15=np.convolve(v,np.ones(15))[:375]; cumv=np.cumsum(v); vwap=np.cumsum(v*(h+l+c)/3)/np.maximum(cumv,1)
        hi=np.maximum.accumulate(h); lo=np.minimum.accumulate(l)
        h20=max(p['h'].max() for p in prev) if DR==1 else min(p['l'].min() for p in prev); rng20=np.mean([(p['h'].max()/p['l'].min()-1)*100 for p in prev])
        nc=ng['c'] if ng else np.full(375,np.nan)
        nw=NW.get(f"{r['day']}|{sym}",{}); lb=L.get(r['day'],{})
        dl=DEL[sym]; pdays=sorted(x for x in dl if x<r['day']); deliv=dl[pdays[-1]] if pdays else np.nan
        argh=np.zeros(375,int)
        for i in range(1,375): argh[i]=(i if h[i]>=h[argh[i-1]] else argh[i-1]) if DR==1 else (i if l[i]<=l[argh[i-1]] else argh[i-1])
        SD+=1
        c5=c[4]; first5=(c5/op-1)*100; rng5=(hi[4]/lo[4]-1)*100
        for i in range(5,331):
            e=c[i]
            fav=(1-l[i+1:361]/e)*100 if DR==1 else (h[i+1:361]/e-1)*100; adv=(h[i+1:361]/e-1)*100 if DR==1 else (1-l[i+1:361]/e)*100
            a05=np.nonzero(adv>=0.05)[0]; a05=a05[0] if len(a05) else 999
            w=np.nonzero(fav>=2.0)[0]; w=w[0] if len(w) else 999
            a5=np.nonzero(adv>=0.5)[0]; a5=a5[0] if len(a5) else 999
            tr=2.0 if w<a5 else (-0.5 if a5<999 else (1-c[360]/e)*100*DR)
            vprev15=v[max(i-29,0):max(i-14,0)].sum()+1
            rows.append([SD,d,i+555,int(w<a05),tr,
                -DR*(e/c[i-3]-1)*100, -DR*(e/c[max(i-15,0)]-1)*100, -DR*(e/c[max(i-30,0)]-1)*100, -DR*(e/op-1)*100,   # + = already falling (with us)
                ((hi[i]-e) if DR==1 else (e-lo[i]))/max(hi[i]-lo[i],1e-9),                    # 0 = at the day's high (best sell spot), 1 = at the day's low
                i-argh[i], (hi[i]/e-1)*100 if DR==1 else (e/lo[i]-1)*100,                          # minutes since the day high, distance below the day high
                -DR*(e/vwap[i]-1)*100,                                  # + = below VWAP
                v15[i]/prof[i], cumv[i]/cumprof[i], v[max(i-14,0):i+1].sum()/vprev15,   # last-15 volume vs normal, day volume vs normal, volume trend (<1 = falling)
                -DR*(nc[i]/nc[max(i-15,0)]-1)*100, -DR*(nc[i]/nc[0]-1)*100, # + = Nifty falling
                DR*(op/pc-1)*100, DR*first5, rng5, DR*r['ret5'], DR*r['prev1'], DR*r['ret20'] if 'ret20' in r else np.nan,
                DR*(e/h20-1)*100, rng20, r['rvol'], deliv, lb.get('vix',np.nan), int(bool(nw)),
                int(any(nw.get(q) for q in ('results_filed','results_meeting','board_outcome'))), lb.get('breadth',np.nan)])
cols=['sd','day','time','clean','tr','fall3','fall15','fall30','fallFromOpen','posFromHigh','minsSinceHigh','belowHigh','belowVwap','vol15x','volDayx','volTrend',
      'niftyFall15','niftyFallOpen','gap','first5','rng5','ret5','prev1','ret20','vs20dHigh','rng20','rvol','prevDeliv','vix','news','results','breadth920']
A=np.array(rows,dtype=float); np.savez_compressed('r3f.npz' if DR==1 else 'r3fb.npz',A=A,cols=np.array(cols))
print('R3 stock-days',len(np.unique(A[:,0])),'rows',len(A),'clean-2% sell minutes',int(A[:,3].sum()),f'({100*A[:,3].mean():.1f}%)')
