# S1-EARLY test (rule 0l): SELL only. Universe: ANY stock with 5-day rise >= 7.6% (known before the open), liquid (20-day median turnover >= Rs 25 cr),
# and ACTIVE: day volume so far >= 3x its normal volume for that minute (previous 20 days). Checked from the first minute.
# Entry: first 1-min bar close where active AND the day's high was made within the last 30 min AND price is >= 0.3% off it.
#   EARLY = bars 09:15..10:25 (first possible entry 09:16).  FALLBACK = same universe but bars 09:20..10:25 only.
# Stop 0.1% beyond the high; exit stop or 15:14; cost 0.146%; Rs 1 lakh/trade. clean = fell >= 2% without going above the sell price (0.05%).
import numpy as np, glob, os, json, sys, collections as C
out={'EARLY':[],'FALLBACK':[]}
syms=sorted({os.path.basename(f)[:-4] for y in range(2022,2027) for f in glob.glob(f'npz{y}/*.npz')})
SKIP={'NIFTY','INDIAVIX'}
for n,sym in enumerate(syms):
    if sym in SKIP or sym.startswith('NIFTY'): continue
    T={k:[] for k in 'thlcv'}
    for y in range(2022,2027):
        f=f'npz{y}/{sym}.npz'
        if os.path.exists(f):
            z=np.load(f)
            for k in 'thlcv': T[k].append(z[k])
    if not T['t']: continue
    D={k:np.concatenate(v).astype(np.float64) for k,v in T.items()}; _,ix=np.unique(D['t'],return_index=True); D={k:v[ix] for k,v in D.items()}
    t=D['t'].astype(np.int64); day=t//1440; mod=t%1440; ok=(mod>=555)&(mod<=929)
    t,day,mod=t[ok],day[ok],mod[ok]; h,l,c,v=D['h'][ok],D['l'][ok],D['c'][ok],D['v'][ok]
    ud,inv=np.unique(day,return_inverse=True); nd=len(ud)
    if nd<40: continue
    last=np.zeros(nd,int); last[inv]=np.arange(len(inv)); dclose=c[last]
    tov=np.zeros(nd); np.add.at(tov,inv,v*c)
    V70=np.zeros((nd,71)); m=mod<=625; np.add.at(V70,(inv[m],mod[m]-555),v[m]); CV=np.cumsum(V70,axis=1)
    cnt=np.bincount(inv,minlength=nd)
    for k in range(21,nd):
        if cnt[k]<300: continue
        r5=(dclose[k-1]/dclose[k-6]-1)*100
        if r5<7.6: continue
        if np.median(tov[k-20:k])<25e7: continue
        base=np.median(CV[k-20:k],axis=0)+1; rv=CV[k]/base
        sl=np.nonzero(inv==k)[0]; s=mod[sl]-555
        H=np.full(375,np.nan); L=np.full(375,np.nan); Cl=np.full(375,np.nan); H[s]=h[sl]; L[s]=l[sl]; Cl[s]=c[sl]
        for q in range(1,375):
            if np.isnan(Cl[q]): Cl[q]=Cl[q-1]; H[q]=Cl[q]; L[q]=Cl[q]
        if np.isnan(Cl[0]): continue
        dstr=str(np.datetime64('1970-01-01')+np.timedelta64(int(ud[k]),'D'))
        for name,start in (('EARLY',0),('FALLBACK',5)):
            for i in range(start,71):
                if rv[i]<3: continue
                ext=H[:i+1].max(); ei=int(np.argmax(H[:i+1])); off=(ext/Cl[i]-1)*100
                if i-ei<=30 and off>=0.3:
                    e=Cl[i]; stop=ext*1.001; res=None; clean=None
                    for j in range(i+1,360):
                        if clean is None:
                            if H[j]>=e*1.0005: clean=0
                            elif L[j]<=e*0.98: clean=1
                        if H[j]>=stop: res=(e-stop)/e*100; break
                    if res is None: res=(e-Cl[359])/e*100
                    out[name].append((dstr,sym,i+555,res-0.146,int(clean or 0),float(rv[i]),float(r5))); break
    if n%100==0: print(n,sym,len(out['EARLY']),flush=True)
json.dump(out,open('s1early.json','w'))
for name,A in out.items():
    print('=====',name,'(SELL only)')
    for lab,f in [('2022',lambda d:d[:4]=='2022'),('2023',lambda d:d[:4]=='2023'),('2024',lambda d:d[:4]=='2024'),('2025',lambda d:d[:4]=='2025'),('2026',lambda d:d[:4]=='2026'),('22-24',lambda d:d<'2025'),('25-26',lambda d:d>='2025')]:
        x=[a for a in A if f(a[0])]
        if not x: continue
        r=np.array([a[3] for a in x]); dd=C.defaultdict(float)
        for a in x: dd[a[0]]+=a[3]*1000
        dv=np.array(list(dd.values()))
        print(f"  {lab:6} trades {len(x):5} win {100*np.mean(r>0):3.0f}% clean2% {100*np.mean([a[4] for a in x]):3.0f}% avg {r.mean():+.3f}% net Rs {r.sum()*1000:+10.0f} | trade-days {len(dv)} losing {100*np.mean(dv<0):.0f}% worst {dv.min():+.0f}")
    tt=np.array([a[2] for a in A]); print('  entry time:', ' '.join(f"{lab} {100*np.mean((tt>=a)&(tt<=b)):.0f}%" for a,b,lab in [(555,555,'09:16'),(556,559,'09:17-09:20'),(560,560,'09:21'),(561,575,'09:22-09:36'),(576,625,'later')]))
