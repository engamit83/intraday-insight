# ENTRY-QUALITY RESEARCH (owner brief 12 Nov 14:50) - dataset of every BASE entry 2022-2026 (replay v2, rules = live BASE: z/step1.json S-BASE).
# Pre-entry factors are measured ONLY with data known before the entry minute. Continuation is measured from the breakout level
# (the 09:15-09:20 high for longs / low for shorts) = the price at which the entry triggers, on the same price scale as the minute data.
import json, glob, os, numpy as np, collections as C
SEC=json.load(open('/home/claude/work/sectors.json'))
IDX={'finance':'NIFTYFINSERV','insurance':'NIFTYFINSERV','bank':'NIFTYBANK','it':'NIFTYIT','pharma':'NIFTYPHARMA','health':'NIFTYPHARMA','auto':'NIFTYAUTO',
     'fmcg':'NIFTYFMCG','consumer':'NIFTYFMCG','metal':'NIFTYMETAL','energy':'NIFTYENERGY','power':'NIFTYENERGY','capgoods':'NIFTYINFRA','infra':'NIFTYINFRA',
     'cement':'NIFTYINFRA','telecom':'NIFTYINFRA','realty':'NIFTYREALTY','media':'NIFTYMEDIA'}
cache={}
def grid(name,day):
    y=day[:4]; k=(name,y)
    if k not in cache:
        f=f'npz{y}/{name}.npz'; cache[k]=np.load(f) if os.path.exists(f) else None
    z=cache[k]
    if z is None: return None
    d=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int)); t=z['t']; m=(t//1440==d)&(t%1440>=555)&(t%1440<=929); ix=np.nonzero(m)[0]
    if len(ix)<100: return None
    s=(t[ix]%1440-555).astype(int); g={}
    for kk in 'ohlc':
        a=np.full(375,np.nan); a[s]=z[kk][ix]
        for q in range(1,375):
            if np.isnan(a[q]): a[q]=a[q-1]
        f0=np.nonzero(~np.isnan(a))[0][0]; a[:f0]=a[f0]; g[kk]=a
    v=np.zeros(375)
    if 'v' in z.files: v[s]=z['v'][ix]
    g['v']=v; return g
rows=[]
for f in sorted(glob.glob('mdays2/20*-S-BASE.json')):
    day=os.path.basename(f)[:10]; D=json.load(open(f))
    if not D.get('trades'): continue
    N=grid('NIFTY',day)
    for t in D['trades']:
        g=grid(t['sym'],day)
        if g is None or N is None: continue
        sg=1 if t['dir']=='BUY' else -1
        m=int(((t['inTs']//1000+19800)%86400)//60)-555          # entry minute index (0 = 09:15)
        if m<5 or m>300: continue
        o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],g['v']
        orh,orl=h[:5].max(),l[:5].min(); lvl=orh if sg==1 else orl; rng=(orh-orl)/orl*100
        p=m-1                                                 # last fully known minute before the entry
        cv=np.cumsum(v[:p+1]); vwap=(np.cumsum(v[:p+1]*(h[:p+1]+l[:p+1]+c[:p+1])/3)/np.maximum(cv,1))[-1] if cv[-1]>0 else c[p]
        nifty_pre=(N['c'][p]/N['o'][0]-1)*100; nifty_or=(N['c'][4]/N['o'][0]-1)*100
        n_twap=N['c'][:p+1].mean()
        sec=SEC.get(t['sym']); X=grid(IDX[sec],day) if sec in IDX else None
        sec_pre=(X['c'][p]/X['o'][0]-1)*100 if X is not None else np.nan
        stock_or=(c[4]/o[0]-1)*100
        orv=v[:5].mean()+1
        mv=lambda k: sg*(c[min(m+k,360)]/lvl-1)*100
        fh=h[m+1:361]; fl=l[m+1:361]
        mfe=max(sg*((fh.max() if sg==1 else fl.min())/lvl-1)*100, mv(0)) if len(fh) else mv(0)
        mae=min(sg*((fl.min() if sg==1 else fh.max())/lvl-1)*100, mv(0)) if len(fh) else mv(0)
        e30=slice(m+1,min(m+31,361))
        mfe30=max(sg*((h[e30].max() if sg==1 else l[e30].min())/lvl-1)*100, mv(0)); mae30=min(sg*((l[e30].min() if sg==1 else h[e30].max())/lvl-1)*100, mv(0))
        back=[sg*(c[q]-lvl)/max(orh-orl,1e-9) for q in range(m+1,min(m+11,361))]
        false_bo=int(min(back)<-0.3) if back else 0           # closed back >=30% of the range inside within 10 min
        rows.append(dict(day=day,sym=t['sym'],dir=t['dir'],re=t.get('re',0),net=t['net'],R=t['R'],mult=t.get('mult',1),reason=t['reason'],
            rvol=t['rvol'],gap=t.get('gap',0) or 0,rangePct=rng,entryMin=m-5,
            niftyPre=sg*nifty_pre, sectorPre=sg*sec_pre if sec_pre==sec_pre else np.nan, secVsNifty=sg*(sec_pre-nifty_pre) if sec_pre==sec_pre else np.nan,
            vwapDist=sg*(lvl/vwap-1)*100, rsOR=sg*(stock_or-nifty_or), niftyVsTwap=sg*(N['c'][p]/n_twap-1)*100,
            approach=sg*(c[p]-c[max(p-5,0)])/max(orh-orl,1e-9), volBO=v[p]/orv,
            mv5=mv(5),mv10=mv(10),mv15=mv(15),mv30=mv(30),mfe=mfe,mae=mae,mfe30=mfe30,mae30=mae30,falseBO=false_bo,clean15=int(mfe30>=1.5 and mae30>-0.05)))
json.dump(rows,open('e2-rows.json','w'),default=float)
print('entries',len(rows),'by year',C.Counter(r['day'][:4] for r in rows),'re-entries',sum(r['re']>0 for r in rows))
