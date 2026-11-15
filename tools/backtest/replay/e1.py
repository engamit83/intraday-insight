# E1 (owner 15 Nov 16:23-16:44): enter AT 09:20 (no breakout wait) on BASE picks, only when the side is confirmed:
#   SELL confirmed = gapped up > 1% vs yesterday's close and/or price <= VWAP(09:15-09:20) - 0.84% ; BUY confirmed = price >= VWAP + 0.84%.
# Judged ALONE (exits ignored): clean >=1.5% / 2% from the entry price (09:20 price + 0.02% slip + 0.01% half spread) before coming back 0.05%.
# PASS MARK (written before results): clean >=1.5% rate >= 1.3x the BASE breakout entry's rate (e3 rows, same measure) in EVERY year 2022-26,
# and >= ~1 entry a day on average; then the tick days must agree.  [OLD DATA - hint for entry timing; the 09:20 side factors are valid]
import json, glob, os, numpy as np, pandas as pd
exec(open('e3.py').read().split('rows=[]; files=')[0])   # reuse loaders: load/daybars/daily
rows=[]
for f in sorted(glob.glob('mdays2/20*-D0.json')):
    day=os.path.basename(f)[:10]; y=day[:4]
    for kk in [kk for kk in list(cache) if int(kk[1])<int(y)-1]: del cache[kk]
    for kk in [kk for kk in list(dcache) if int(kk[1])<int(y)]: del dcache[kk]
    D=json.load(open(f)); d0=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int))
    for p in D.get('picks') or []:
        g=daybars(p['sym'],day)
        if g is None: continue
        o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],g['v']; sg=1 if p['dir']=='BUY' else -1
        dl=daily(p['sym'],y); prev=[k for k in sorted(dl) if k<d0]
        if not prev: continue
        pc=dl[prev[-1]][0]; gap=(o[0]/pc-1)*100
        cv=v[:5].sum(); vw=(v[:5]*(h[:5]+l[:5]+c[:5])/3).sum()/cv if cv>0 else c[4]
        vd=sg*(c[4]/vw-1)*100; e=c[4]*(1+sg*0.0003)
        conf_gap=int(sg==-1 and gap>1.0); conf_vw=int(vd>=0.84)
        fav=(h[5:361]/e-1)*100 if sg==1 else (1-l[5:361]/e)*100; adv=(1-l[5:361]/e)*100 if sg==1 else (h[5:361]/e-1)*100
        b=np.nonzero(adv>=0.05)[0]; b=b[0] if len(b) else 10**9
        cl={}
        for x in (1.5,2.0):
            w=np.nonzero(fav>=x)[0]; cl[x]=int((w[0] if len(w) else 10**9)<b)
        rows.append(dict(day=day,sym=p['sym'],side=sg,gap=gap,vwapDist=vd,confGap=conf_gap,confVw=conf_vw,c15=cl[1.5],c20=cl[2.0],
                         mv30=sg*(c[35]/e-1)*100,mae30=min(adv[:30].max()*-1,0),eod=int(sg*(c[359]-e)>0)))
R=pd.DataFrame(rows); R['y']=R.day.str[:4].astype(int); R.to_csv('e1-rows.csv',index=False)
B=pd.DataFrame(json.load(open('e3-rows.json'))); B['y']=B.day.str[:4].astype(int)
nd=R.groupby('y').day.nunique()
def line(nm,S,y): return f"{nm:34} n {len(S):5} ({len(S)/nd[y]:.1f}/day) clean1.5 {100*S.c15.mean():5.1f}% clean2 {100*S.c20.mean():5.1f}% mv30 {S.mv30.mean():+.3f}% eod-right {100*S.eod.mean():4.1f}%"
for y in [2022,2023,2024,2025,2026]:
    S=R[R.y==y]; Bb=B[(B.y==y)]
    print(f"--- {y} | BASE breakout entries: n {len(Bb)} clean1.5 {100*Bb.clean15.mean():.1f}%")
    print('  '+line('all picks at 09:20 (no confirmation)',S,y))
    print('  '+line('E1a sells after gap-up >1%',S[S.confGap==1],y))
    print('  '+line('E1b VWAP >=0.84% our way',S[S.confVw==1],y))
    E=S[(S.confGap==1)|(S.confVw==1)]; print('  '+line('E1 = either',E,y), '| x BASE %.2f'%(E.c15.mean()/Bb.clean15.mean()))
