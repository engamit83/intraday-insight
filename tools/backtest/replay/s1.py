# SCENARIO S1 (owner 11 Nov 23:31) - ONE fixed rule, both sides, no tuning:
# Stock: 09:20 pick with 5-day move >= 7.6% (up -> SELL, down -> BUY).
# Entry: first minute close from 09:20 to 10:25 where the day's extreme (high for sell / low for buy) was made within the last 30 min
#        and price has come >= 0.3% off it. Stop: 0.1% beyond that extreme. Exit: stop or 15:14 close. Rs 1 lakh/trade, cost 0.146%.
import json,numpy as np,os,collections as C
R=json.load(open('s2rows.json')); cache={}
def grid(sym,day):
    y=day[:4]
    if (sym,y) not in cache: cache[(sym,y)]=np.load(f'npz{y}/{sym}.npz')
    z=cache[(sym,y)]; d=(np.datetime64(day)-np.datetime64('1970-01-01')).astype(int); t=z['t']; m=(t//1440==d)&(t%1440>=555)&(t%1440<=929); ix=np.nonzero(m)[0]
    s=(t[ix]%1440-555).astype(int); g={}
    for k in 'hlc':
        a=np.full(375,np.nan); a[s]=z[k][ix]
        for q in range(1,375):
            if np.isnan(a[q]): a[q]=a[q-1]
        f=np.nonzero(~np.isnan(a))[0][0]; a[:f]=a[f]; g[k]=a
    return g
out=[]
for r in R:
    dr=-1 if r['ret5']>=7.6 else (1 if r['ret5']<=-7.6 else 0)
    if dr==0: continue
    g=grid(r['sym'],r['day']); h,l,c=g['h'],g['l'],g['c']
    for i in range(5,71):
        ext=h[:i+1].max() if dr==-1 else l[:i+1].min(); ei=int(np.argmax(h[:i+1])) if dr==-1 else int(np.argmin(l[:i+1]))
        off=(ext/c[i]-1)*100 if dr==-1 else (c[i]/ext-1)*100
        if i-ei<=30 and off>=0.3:
            e=c[i]; stop=ext*1.001 if dr==-1 else ext*0.999; res=None
            for j in range(i+1,360):
                if (h[j]>=stop) if dr==-1 else (l[j]<=stop): res=(e-stop)/e*100 if dr==-1 else (stop-e)/e*100; break
            if res is None: res=(e-c[359])/e*100 if dr==-1 else (c[359]-e)/e*100
            out.append((r['day'],dr,res-0.146,i,off)); break
A=out
for side,nm in ((-1,'SELL (5-day rise >=7.6%)'),(1,'BUY (5-day fall >=7.6%)'),(0,'BOTH')):
    print(nm)
    for lab,f in [('2022',lambda d:d[:4]=='2022'),('2023',lambda d:d[:4]=='2023'),('2024',lambda d:d[:4]=='2024'),('2025',lambda d:d[:4]=='2025'),('2026',lambda d:d[:4]=='2026'),('22-24',lambda d:d<'2025'),('25-26',lambda d:d>='2025')]:
        x=[a for a in A if f(a[0]) and (side==0 or a[1]==side)]
        if not x: continue
        r_=np.array([a[2] for a in x]); dd=C.defaultdict(float)
        for a in x: dd[a[0]]+=a[2]*1000
        dv=np.array(list(dd.values()))
        print(f"  {lab:6} trades {len(x):4} win {100*np.mean(r_>0):3.0f}% avg {r_.mean():+.3f}% net Rs {r_.sum()*1000:+9.0f} | trade-days {len(dv)} losing {100*np.mean(dv<0):.0f}% worst {dv.min():+.0f} | avg stop distance {np.mean([a[4] for a in x])+0.1:.2f}%")
json.dump(A,open('s1-trades.json','w'))
