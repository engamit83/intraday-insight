# DIRECTION STUDY (owner 13 Nov 00:10 "work on direction"). Rule 0k: the 09:20 decision is where old minute data = live ticks -> 5 years usable.
# Unit: every BASE 09:20 candidate (S-RAW picks = top 10 by rvol, before the gap filter), 2022-26.
# Everything is measured with data KNOWN at 09:20:00 (minute bars 09:15..09:19; previous days; US/Europe of the PREVIOUS date only).
# Targets (from the 09:20:00 price = close of the 09:19 bar):
#   up15/dn15 = goes +1.5% up / down clean (before 0.05% the other way), until 15:15 (strict: a bar touching both = came back first)
#   eod = sign of 15:14 close vs the 09:20 price.
import json, glob, os, numpy as np, collections as C
SEC=json.load(open('/home/claude/work/sectors.json'))
IDX={'finance':'NIFTYFINSERV','insurance':'NIFTYFINSERV','bank':'NIFTYBANK','it':'NIFTYIT','pharma':'NIFTYPHARMA','health':'NIFTYPHARMA','auto':'NIFTYAUTO',
     'fmcg':'NIFTYFMCG','consumer':'NIFTYFMCG','metal':'NIFTYMETAL','energy':'NIFTYENERGY','power':'NIFTYENERGY','capgoods':'NIFTYINFRA','infra':'NIFTYINFRA',
     'cement':'NIFTYINFRA','telecom':'NIFTYINFRA','realty':'NIFTYREALTY','media':'NIFTYMEDIA'}
G=json.load(open('fac/global.json')); L=json.load(open('labels920.json'))
gdays=sorted(G)
cache={}
def load(sym,y):
    k=(sym,y)
    if k not in cache:
        f=f'npz{y}/{sym}.npz'
        if os.path.exists(f):
            z=np.load(f); t=z['t']; cache[k]=(t,z['o'].astype(float),z['h'].astype(float),z['l'].astype(float),z['c'].astype(float),z['v'].astype(float) if 'v' in z.files else np.zeros(len(t)))
        else: cache[k]=None
    return cache[k]
def daybars(sym,day):
    y=int(day[:4]); z=load(sym,str(y))
    if z is None: return None
    t,o,h,l,c,v=z; d=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int))
    a=np.searchsorted(t,d*1440+555); b=np.searchsorted(t,d*1440+930)
    if b-a<200: return None
    m=t[a:b]%1440-555
    g={}
    for nm,arr in (('o',o),('h',h),('l',l),('c',c)):
        x=np.full(375,np.nan); x[m]=arr[a:b]
        for q in range(1,375):
            if np.isnan(x[q]): x[q]=x[q-1]
        f0=np.nonzero(~np.isnan(x))[0][0]; x[:f0]=x[f0]; g[nm]=x
    vv=np.zeros(375); vv[m]=v[a:b]; g['v']=vv; return g
def prevdays(sym,day,n):
    # last n full-day closes before day (same + previous year file), from minute data
    out=[]; y=int(day[:4])
    for yy in (y,y-1):
        z=load(sym,str(yy))
        if z is None: continue
        t,o,h,l,c,v=z; d=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int))
        dd=t//1440; m=(dd<d)&(t%1440<=929)&(t%1440>=555)
        if not m.any(): continue
        ud=np.unique(dd[m])[::-1]
        for x in ud:
            if len(out)>=n: break
            mm=(dd==x)&m; out.append((int(x),c[mm][-1],h[mm].max(),l[mm].min()))
        if len(out)>=n: break
    return out
rows=[]
files=sorted(glob.glob('mdays2/20*-S-RAW.json'))
for fi,f in enumerate(files):
    day=os.path.basename(f)[:10]; D=json.load(open(f))
    for kk in [kk for kk in cache if int(kk[1])<int(day[:4])-1]: del cache[kk]   # memory: keep only this + previous year
    N=daybars('NIFTY',day)
    if N is None or not D.get('picks'): continue
    lb=L.get(day,{})
    k=gdays.index(day) if day in gdays else None
    gp=G[gdays[k-1]] if k else {}             # previous date's US/Europe moves (known before 09:15)
    VX=daybars('INDIAVIX',day)
    npv=prevdays('NIFTY',day,2)
    n_gap=(N['o'][0]/npv[0][1]-1)*100 if npv else np.nan
    n_or=(N['c'][4]/N['o'][0]-1)*100; n_prev=(npv[0][1]/npv[1][1]-1)*100 if len(npv)>1 else np.nan
    for p in D['picks']:
        g=daybars(p['sym'],day)
        if g is None: continue
        pv=prevdays(p['sym'],day,21)
        if len(pv)<21: continue
        o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],g['v']; e=c[4]; pc=pv[0][1]
        orh,orl=h[:5].max(),l[:5].min()
        fav_u=(h[5:360]/e-1)*100; adv_u=(1-l[5:360]/e)*100
        def clean(fav,adv):
            w=np.nonzero(fav>=1.5)[0]; b=np.nonzero(adv>=0.05)[0]
            return int(len(w)>0 and (len(b)==0 or w[0]<b[0]))   # same bar -> b first (strict)
        up=clean(fav_u,adv_u); dn=clean(adv_u*0+(1-l[5:360]/e)*100,(h[5:360]/e-1)*100)
        sec=SEC.get(p['sym']); X=daybars(IDX[sec],day) if sec in IDX else None
        cl=[x[1] for x in pv]
        rows.append(dict(day=day,sym=p['sym'],pickDir=1 if p['dir']=='BUY' else -1,rvol=p['rvol'],
            up=up,dn=dn,eod=float(np.sign(c[359]-e)),mv=(c[359]/e-1)*100,
            gap=(o[0]/pc-1)*100, orMove=(e/o[0]-1)*100, orPos=(e-orl)/max(orh-orl,1e-9), orRange=(orh/orl-1)*100,
            orVsNifty=(e/o[0]-1)*100-n_or, secOr=(X['c'][4]/X['o'][0]-1)*100 if X is not None else np.nan,
            prev1=(cl[0]/cl[1]-1)*100, ret5=(cl[0]/cl[5]-1)*100, ret20=(cl[0]/cl[20]-1)*100,
            prevPos=(pc-pv[0][3])/max(pv[0][2]-pv[0][3],1e-9), vsPrevHigh=(e/pv[0][2]-1)*100, vsPrevLow=(e/pv[0][3]-1)*100,
            first1=(c[0]/o[0]-1)*100, last2=(c[4]/c[2]-1)*100,
            upMins=int(sum(c[q]>o[q] for q in range(5))),
            nGap=n_gap, nOr=n_or, nPrev=n_prev, breadth=lb.get('breadth',np.nan), vix=VX['o'][0] if VX is not None else np.nan,
            vixOr=(VX['c'][4]/VX['o'][0]-1)*100 if VX is not None else np.nan,
            spx=gp.get('SP500',np.nan), nasdaq=gp.get('NASDAQ',np.nan), dax=gp.get('DAX',np.nan), usvix=gp.get('USVIX',np.nan),
            expiry=int(bool(lb.get('expiry'))), weekday=lb.get('weekday',np.nan)))
    if fi%100==0: print(day,len(rows),flush=True)
json.dump(rows,open('dirfac-rows.json','w'),default=float)
print('rows',len(rows),'days',len({r['day'] for r in rows}))
