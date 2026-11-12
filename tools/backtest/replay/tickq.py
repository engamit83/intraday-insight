# ENTRY-QUALITY on LIVE TICK DAYS (owner 12 Nov 17:16): same factors/filters as e2 (old-data study), measured on real recorded ticks.
# Entries: BASE rules replayed on each Sharekhan tick day (rp.mjs, verified = live), plus the 12 Nov Zerodha live trades.
import json, subprocess, pandas as pd, numpy as np, os, sys
sys.path.insert(0,'.')
SEC=json.load(open('/home/claude/work/sectors.json'))
IDX={'finance':'NIFTYFINSERV','insurance':'NIFTYFINSERV','bank':'NIFTYBANK','it':'NIFTYIT','pharma':'NIFTYPHARMA','health':'NIFTYPHARMA','auto':'NIFTYAUTO',
     'fmcg':'NIFTYFMCG','consumer':'NIFTYFMCG','metal':'NIFTYMETAL','energy':'NIFTYENERGY','power':'NIFTYENERGY','capgoods':'NIFTYINFRA','infra':'NIFTYINFRA',
     'cement':'NIFTYINFRA','telecom':'NIFTYINFRA','realty':'NIFTYREALTY','media':'NIFTYMEDIA'}
BASE=dict(json.load(open('step1.json')))['S-BASE']
days=['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06','2026-11-09','2026-11-12']
def bars(df,sym):
    x=df[df.symbol==sym]
    if x.empty: return None
    m=(x.time.str.slice(0,2).astype(int)*60+x.time.str.slice(3,5).astype(int)-555).to_numpy()
    p=x.price.to_numpy(float); dv=x.day_volume.to_numpy(float) if 'day_volume' in x else np.zeros(len(x))
    dv=np.nan_to_num(dv); v=np.diff(dv,prepend=dv[0]); v[v<0]=0
    o=np.full(375,np.nan);h=o.copy();l=o.copy();c=o.copy();vol=np.zeros(375)
    for k in np.unique(m):
        if k<0 or k>374: continue
        s=m==k; o[k]=p[s][0]; h[k]=p[s].max(); l[k]=p[s].min(); c[k]=p[s][-1]; vol[k]=v[s].sum()
    for k in range(1,375):
        if np.isnan(c[k]): c[k]=c[k-1]; o[k]=h[k]=l[k]=c[k]
    if np.isnan(c[0]): return None
    return dict(o=o,h=h,l=l,c=c,v=vol)
rows=[]
for day in days:
    if day=='2026-11-12':
        tf='/mnt/user-data/uploads/live-feed/data/ticks-2026-11-12.csv'
        tr=pd.read_csv('/mnt/user-data/uploads/live-feed/data/sip-trades-2026-11-12.csv')
        T=[dict(sym=r.symbol,dir=r.dir,rvol=r.rvol,gap=r.gap_with_pct,net=r.net_rs,re=0 if r.reentry=='no' else 1,
                m=int(r.entry_time[:2])*60+int(r.entry_time[3:5])-555) for r in tr.itertuples()]
    else:
        tf=f'tmp/to-{day}.csv'
        out=subprocess.run(['node','/home/claude/work/rp.mjs',tf,f'cb-{day}.json',day,'',json.dumps(BASE)],capture_output=True,text=True).stdout.strip().split('\n')[-1]
        J=json.loads(out)
        T=[dict(sym=t['sym'],dir=t['dir'],rvol=t.get('rvol'),gap=t.get('gap') or 0,net=t['net'],re=t.get('re',0),
                m=int(((t['inTs']//1000+19800)%86400)//60)-555) for t in J['trades']]
    need={t['sym'] for t in T}|{'NIFTY'}|{IDX[SEC[s]] for s in {t['sym'] for t in T} if SEC.get(s) in IDX}
    df=pd.read_csv(tf,usecols=['time','symbol','price','day_volume'])
    df=df[df.symbol.isin(need)&(df.price>0)]
    B={s:bars(df,s) for s in need}; N=B.get('NIFTY')
    for t in T:
        g=B.get(t['sym']); m=t['m']
        if g is None or N is None or m<5 or m>300: continue
        sg=1 if t['dir']=='BUY' else -1; o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],g['v']
        orh,orl=np.nanmax(h[:5]),np.nanmin(l[:5]); lvl=orh if sg==1 else orl; p=m-1
        cv=np.cumsum(v[:p+1]); vwap=(np.cumsum(v[:p+1]*(h[:p+1]+l[:p+1]+c[:p+1])/3)/np.maximum(cv,1))[-1] if cv[-1]>0 else c[p]
        X=B.get(IDX.get(SEC.get(t['sym']),''),None)
        nifty_pre=(N['c'][p]/N['o'][0]-1)*100; sec_pre=(X['c'][p]/X['o'][0]-1)*100 if X else np.nan
        mv=lambda k: sg*(c[min(m+k,360)]/lvl-1)*100
        e30=slice(m+1,min(m+31,361))
        mfe30=max(sg*((np.nanmax(h[e30]) if sg==1 else np.nanmin(l[e30]))/lvl-1)*100,mv(0)); mae30=min(sg*((np.nanmin(l[e30]) if sg==1 else np.nanmax(h[e30]))/lvl-1)*100,mv(0))
        back=[sg*(c[q]-lvl)/max(orh-orl,1e-9) for q in range(m+1,min(m+11,361))]
        rows.append(dict(day=day,sym=t['sym'],dir=t['dir'],re=t['re'],net=t['net'],rvol=t['rvol'],gap=t['gap'],entryMin=m-5,
            vwapDist=sg*(lvl/vwap-1)*100, rsOR=sg*((c[4]/o[0]-1)*100-(N['c'][4]/N['o'][0]-1)*100), niftyVsTwap=sg*(N['c'][p]/np.nanmean(N['c'][:p+1])-1)*100,
            secVsNifty=sg*(sec_pre-nifty_pre) if sec_pre==sec_pre else np.nan, approach=sg*(c[p]-c[max(p-5,0)])/max(orh-orl,1e-9), volBO=v[p]/(v[:5].mean()+1),
            mv30=mv(30),mfe30=mfe30,mae30=mae30,falseBO=int(min(back)<-0.3) if back else 0,clean15=int(mfe30>=1.5 and mae30>-0.05)))
    print(day,'entries',len(T),flush=True)
json.dump(rows,open('tickq-rows.json','w'),default=float)
R=rows
def line(name,S):
    if not S: return f'  {name:40} n    0'
    a=lambda k: np.mean([r[k] for r in S]); net=np.array([r['net'] for r in S]); w=net[net>0].sum(); l_=-net[net<0].sum()
    return f"  {name:40} n {len(S):3} | win {100*np.mean(net>0):3.0f}% | 30-min {a('mv30'):+.2f}% | MFE30 {a('mfe30'):+.2f}% MAE30 {a('mae30'):+.2f}% | false BO {100*a('falseBO'):3.0f}% | clean1.5 {100*a('clean15'):3.0f}% | net Rs {net.sum():+7.0f} PF {w/l_ if l_ else 9.99:.2f}"
F={'Baseline (all BASE entries)':lambda r:True,'A VWAP alignment':lambda r:r['vwapDist']>0,'B relative strength':lambda r:r['rsOR']>0,'C market trend':lambda r:r['niftyVsTwap']>0,
   'D sector vs Nifty':lambda r:r['secVsNifty']==r['secVsNifty'] and r['secVsNifty']>0,'E RVOL>5':lambda r:(r['rvol'] or 0)>5,'E RVOL>7':lambda r:(r['rvol'] or 0)>7,'E RVOL>10':lambda r:(r['rvol'] or 0)>10,
   'F1 approach (old-data median 0.30)':lambda r:r['approach']>=0.30,'F2 breakout volume (old-data median 0.47)':lambda r:r['volBO']>=0.47,
   'LATE breakout (>=09:37)':lambda r:r['entryMin']>=17,'early breakout (<09:37)':lambda r:r['entryMin']<17,
   'A+B+C+D':lambda r:r['vwapDist']>0 and r['rsOR']>0 and r['niftyVsTwap']>0 and r['secVsNifty']==r['secVsNifty'] and r['secVsNifty']>0}
print(f'\nLIVE TICK DAYS: {len(set(r["day"] for r in R))} days, {len(R)} BASE entries [TICK - small sample]')
for n,f in F.items(): print(line(n,[r for r in R if f(r)]))
