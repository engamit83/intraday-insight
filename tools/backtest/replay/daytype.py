# daytype.py - label every day (owner plan step 3): uses NIFTY + INDIAVIX 1-min (npz) and breadth of liquid stocks.
#  gap      : Nifty open vs yesterday's close
#  move     : Nifty 09:20 -> 15:29 ; range = (high-low)/open over the day
#  breadth  : % of liquid stocks above their own open at 15:29 (at 10:15 too)
#  VIX      : level at 09:20 ; types: TREND UP / TREND DOWN (|move|>=0.8% and range mostly one way), WILD (range>=1.8% or VIX jump),
#             NARROW (Nifty and breadth disagree), FLAT (range<0.6%), NORMAL UP / NORMAL DOWN otherwise.
import sys,glob,os,json,numpy as np,datetime as dt
NPZ=sys.argv[1]
L=lambda s:np.load(f'{NPZ}/{s}.npz')
def by_day(z):
    t=z['t']; d=t//1440; out={}
    for dd in np.unique(d):
        m=d==dd; out[int(dd)]=(t[m]%1440,z['o'][m],z['h'][m],z['l'][m],z['c'][m],z['v'][m])
    return out
N=by_day(L('NIFTY')); V=by_day(L('INDIAVIX')) if os.path.exists(f'{NPZ}/INDIAVIX.npz') else {}
stocks={os.path.basename(f)[:-4]:by_day(np.load(f)) for f in glob.glob(NPZ+'/*.npz') if not os.path.basename(f).startswith(('NIFTY','INDIAVIX'))}
def at(x,k):
    tt=x[0]; i=np.searchsorted(tt,k,side='right')-1; return float(x[4][max(i,0)])
days=sorted(N); res={}
for i,dd in enumerate(days):
    n=N[dd]; o=float(n[1][0]); pc=float(N[days[i-1]][4][-1]) if i else None
    gap=(o/pc-1)*100 if pc else 0; c20=at(n,559); c15=at(n,615); cl=at(n,929)
    move=(cl/c20-1)*100; rng=(float(n[2].max())-float(n[3].min()))/o*100; day_move=(cl/o-1)*100
    br=[]; br10=[]
    for s,D in stocks.items():
        if dd in D and len(D[dd][0])>200: so=float(D[dd][1][0]); br.append(at(D[dd],929)>so); br10.append(at(D[dd],615)>so)
    b=np.mean(br)*100 if br else 50; b10=np.mean(br10)*100 if br10 else 50
    vix=at(V[dd],559) if dd in V else None; vjump=((at(V[dd],929)/float(V[dd][1][0])-1)*100) if dd in V else 0
    if rng>=1.8 or vjump>=8: typ='WILD'
    elif abs(day_move)>=0.8 and abs(day_move)>=0.6*rng: typ='TREND UP' if day_move>0 else 'TREND DOWN'
    elif (day_move>0.3 and b<45) or (day_move<-0.3 and b>55): typ='NARROW'
    elif rng<0.6: typ='FLAT'
    else: typ='NORMAL UP' if day_move>0 else 'NORMAL DOWN'
    day=(dt.date(1970,1,1)+dt.timedelta(days=dd)).isoformat()
    res[day]=dict(type=typ,gap=round(gap,2),move_after_0920=round(move,2),day_move=round(day_move,2),range=round(rng,2),breadth_close=round(b),breadth_1015=round(b10),vix=vix and round(vix,2),vix_change=round(vjump,1))
json.dump(res,open('daytypes.json','w'),indent=0)
from collections import Counter
print(Counter(r['type'] for r in res.values()))
