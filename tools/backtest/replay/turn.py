# REAL 2% ENTRY TEST (owner 11 Nov 14:41). Only information known at that minute.
# RULE: window 09:20-10:30; day volume so far >= VOLX x normal (same time, previous 20 days).
# BUY when price closes >= CONF% above the day's low (low made at/after 09:15); SELL when <= CONF% below the day's high.
# First trigger of the day only (either side). Entry = that minute's close. Stop = day low (buy) / day high (sell) at entry,
# but at least 0.3% away. Target = +2%. Else exit 15:15 close. Costs 0.146% (incl. slippage).
# PASS MARK (written first): avg after costs > 0 in BOTH 2022-24 and 2025-26, >= 60 trades each, for the stock.
import numpy as np, sys, os
SYM=sys.argv[1]
def load(name):
    T={k:[] for k in 'tohlcv'}
    for y in range(2022,2027):
        z=np.load(f'npz{y}/{name}.npz')
        for k in 'tohlcv': T[k].append(z[k])
    D={k:np.concatenate(v).astype(float) for k,v in T.items()}; _,ix=np.unique(D['t'],return_index=True); return {k:v[ix] for k,v in D.items()}
S=load(SYM); day=(S['t']//1440).astype(int); mod=(S['t']%1440).astype(int)
G={}
for d in np.unique(day):
    m=(day==d)&(mod>=555)&(mod<=929); ix=np.nonzero(m)[0]
    if len(ix)<300: continue
    s=mod[ix]-555; g={}
    for k in 'ohlc':
        a=np.full(375,np.nan); a[s]=S[k][ix]
        for q in range(375):
            if np.isnan(a[q]) and q>0: a[q]=a[q-1]
        f=np.nonzero(~np.isnan(a))[0][0]; a[:f]=a[f]; g[k]=a
    v=np.zeros(375); v[s]=S['v'][ix]; g['v']=v; G[int(d)]=g
dl=sorted(G)
def run(CONF,VOLX,END_WIN=75):  # END_WIN 75 = 10:30
    res=[]
    for k,d in enumerate(dl):
        if k<20: continue
        g=G[d]; h,l,c,v=g['h'],g['l'],g['c'],g['v']; cv=np.cumsum(v)
        base=np.median(np.array([np.cumsum(G[dl[j]]['v']) for j in range(k-20,k)]),axis=0)+1
        lo=np.minimum.accumulate(l); hi=np.maximum.accumulate(h)
        for i in range(5,END_WIN+1):
            if cv[i]<VOLX*base[i]: continue
            dr=0
            if c[i]>=lo[i]*(1+CONF/100): dr=1
            elif c[i]<=hi[i]*(1-CONF/100): dr=-1
            if dr==0: continue
            e=c[i]; stop=min(lo[i],e*0.997) if dr==1 else max(hi[i],e*1.003); tgt=e*1.02 if dr==1 else e*0.98
            out=None
            for j in range(i+1,361):
                if dr==1:
                    if l[j]<=stop: out=(stop/e-1)*100; break
                    if h[j]>=tgt: out=2.0; break
                else:
                    if h[j]>=stop: out=(1-stop/e)*100; break
                    if l[j]<=tgt: out=2.0; break
            if out is None: out=(c[360]/e-1)*100*dr
            yr=int(str(np.datetime64('1970-01-01')+np.timedelta64(d,'D'))[:4]); res.append((yr,out-0.146,dr,i)); break
    return res
print(f'===== {SYM}  (old data - hint only)')
for VOLX in (1.0,1.5):
    for CONF in (0.3,0.5,0.8):
        r=run(CONF,VOLX);
        s=f'  volume>={VOLX}x confirm {CONF}%:'
        ok=True
        for P,f in (('22-24',lambda y:y<=2024),('25-26',lambda y:y>=2025)):
            x=np.array([o for y,o,_,_ in r if f(y)])
            s+=f' | {P}: {len(x)} trades, win {100*np.mean(x>0):.0f}%, avg {x.mean():+.3f}%, total {x.sum():+.0f}%'
            ok&= len(x)>=60 and x.mean()>0
        yrs=' '.join(f'{y}:{sum(o for yy,o,_,_ in r if yy==y):+.0f}%' for y in range(2022,2027))
        print(s+f' | per year {yrs} {"PASS" if ok else "-"}')
