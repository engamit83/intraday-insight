# CONFIRMATION-FACTOR STUDY (owner prompt 15 Nov 14:06). Direction (09:20 vs official open) and the breakout entry are FIXED (BASE).
# Unit: every BASE entry 2022-26 (replay D0 = live BASE rules). Factors use ONLY data known before the entry minute.
# Outcomes are measured from the PRICE AT ENTRY (fill scaled to minute data, minus 0.02% slip + 0.01% half spread) - not the breakout level
# (12 Nov lesson). Minute data: hint for timing-based outcomes, exact for 09:20 factors (rule 0w).
import json, glob, os, numpy as np
SEC=json.load(open('/home/claude/work/sectors.json')); L=json.load(open('labels920.json'))
IDX={'finance':'NIFTYFINSERV','insurance':'NIFTYFINSERV','bank':'NIFTYBANK','it':'NIFTYIT','pharma':'NIFTYPHARMA','health':'NIFTYPHARMA','auto':'NIFTYAUTO',
     'fmcg':'NIFTYFMCG','consumer':'NIFTYFMCG','metal':'NIFTYMETAL','energy':'NIFTYENERGY','power':'NIFTYENERGY','capgoods':'NIFTYINFRA','infra':'NIFTYINFRA',
     'cement':'NIFTYINFRA','telecom':'NIFTYINFRA','realty':'NIFTYREALTY','media':'NIFTYMEDIA'}
cache={}
def load(sym,y):
    k=(sym,y)
    if k not in cache:
        f=f'npz{y}/{sym}.npz'
        if os.path.exists(f):
            z=np.load(f); cache[k]=(z['t'],z['o'].astype(float),z['h'].astype(float),z['l'].astype(float),z['c'].astype(float),z['v'].astype(float) if 'v' in z.files else np.zeros(len(z['t'])))
        else: cache[k]=None
    return cache[k]
def daybars(sym,day):
    z=load(sym,day[:4])
    if z is None: return None
    t,o,h,l,c,v=z; d=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int))
    a=np.searchsorted(t,d*1440+555); b=np.searchsorted(t,d*1440+930)
    if b-a<200: return None
    m=t[a:b]%1440-555; g={}
    for nm,arr in (('o',o),('h',h),('l',l),('c',c)):
        x=np.full(375,np.nan); x[m]=arr[a:b]
        for q in range(1,375):
            if np.isnan(x[q]): x[q]=x[q-1]
        f0=np.nonzero(~np.isnan(x))[0][0]; x[:f0]=x[f0]; g[nm]=x
    vv=np.zeros(375); vv[m]=v[a:b]; g['v']=vv; return g
dcache={}
def daily(sym,y):
    # per stock-year: sorted day list with close/high/low (from minute data)
    k=(sym,y)
    if k not in dcache:
        out={}
        for yy in (str(int(y)-1),y):
            z=load(sym,yy)
            if z is None: continue
            t,o,h,l,c,v=z; mm=(t%1440>=555)&(t%1440<=929); dd=t//1440
            for d in np.unique(dd[mm]):
                s=mm&(dd==d)
                if s.sum()>=100: out[int(d)]=(c[s][-1],h[s].max(),l[s].min())
        dcache[k]=out
    return dcache[k]
rows=[]; files=sorted(glob.glob('mdays2/20*-D0.json'))
for fi,f in enumerate(files):
    day=os.path.basename(f)[:10]; y=day[:4]
    for kk in [kk for kk in list(cache) if int(kk[1])<int(y)-1]: del cache[kk]
    for kk in [kk for kk in list(dcache) if int(kk[1])<int(y)]: del dcache[kk]
    D=json.load(open(f)); N=daybars('NIFTY',day)
    if N is None or not D.get('trades'): continue
    P={p['sym']:p for p in D.get('picks') or []}; lb=L.get(day,{})
    nd=daily('NIFTY',y); npv=[k for k in sorted(nd) if k< int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int))]; npc=nd[npv[-1]][0] if npv else None
    d0=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int))
    for t in D['trades']:
        g=daybars(t['sym'],day); pk=P.get(t['sym'])
        if g is None or pk is None or not pk.get('high'): continue
        o,h,l,c,v=g['o'],g['h'],g['l'],g['c'],g['v']; sg=1 if t['dir']=='BUY' else -1
        m=int(((t['inTs']//1000+19800)%86400)//60)-555
        if m<5 or m>330: continue
        orh,orl=h[:5].max(),l[:5].min(); fct=orh/pk['high']; e=t['entry']*fct/(1+sg*0.0003); p=m-1
        dl=daily(t['sym'],y); prev=sorted(k for k in dl if k<d0)
        if len(prev)<21: continue
        pc,ph,pl=dl[prev[-1]]; cl=[dl[k][0] for k in prev[-21:]]; rng20=np.mean([(dl[k][1]/dl[k][2]-1)*100 for k in prev[-20:]])
        sec=SEC.get(t['sym']); X=daybars(IDX[sec],day) if sec in IDX else None
        npre=(N['c'][p]/N['o'][0]-1)*100; spre=(X['c'][p]/X['o'][0]-1)*100 if X is not None else np.nan
        cumv=np.cumsum(v[:p+1]); vw=(np.cumsum(v[:p+1]*(h[:p+1]+l[:p+1]+c[:p+1])/3)/np.maximum(cumv,1))[-1] if cumv[-1]>0 else c[p]
        mv=lambda k: sg*(c[min(m+k,360)]/e-1)*100
        w=slice(m+1,min(m+31,361)); hi30=h[w].max(); lo30=l[w].min()
        fav=(h[m+1:361]/e-1)*100 if sg==1 else (1-l[m+1:361]/e)*100; adv=(1-l[m+1:361]/e)*100 if sg==1 else (h[m+1:361]/e-1)*100
        wi=np.nonzero(fav>=1.5)[0]; bi=np.nonzero(adv>=0.05)[0]; clean=int(len(wi)>0 and (len(bi)==0 or wi[0]<bi[0]))
        lvl=orh if sg==1 else orl; back=[sg*(c[q]-lvl)/max(orh-orl,1e-9) for q in range(m+1,min(m+11,361))]
        rows.append(dict(day=day,sym=t['sym'],side=sg,re=t.get('re',0),net=t['net'],
          # A opening range
          orRange=(orh/orl-1)*100, orVs20=(orh/orl-1)*100/max(rng20,0.1), orPos=((c[4]-orl)/max(orh-orl,1e-9)) if sg==1 else ((orh-c[4])/max(orh-orl,1e-9)),
          first1=sg*(c[0]/o[0]-1)*100, upMins=sum(1 for q in range(5) if sg*(c[q]-o[q])>0), orMove=sg*(c[4]/o[0]-1)*100,
          # B timing
          entryMin=m-5,
          # C/D volume, rvol
          rvol=t.get('rvol') or pk.get('rvol'), volBO=v[p]/(v[:5].mean()+1), volPre5=v[max(p-4,0):p+1].mean()/(v[:5].mean()+1),
          # E gap
          gap=sg*(o[0]/pc-1)*100, gapAbs=abs(o[0]/pc-1)*100, vsPrevExt=sg*(e/(ph if sg==1 else pl)-1)*100,
          # F breadth, G Nifty, H sector
          breadth=sg*(lb.get('breadth',np.nan)-50), niftyOR=sg*(N['c'][4]/N['o'][0]-1)*100, niftyPre=sg*npre,
          niftyGap=sg*(N['o'][0]/npc-1)*100 if npc else np.nan,
          secPre=sg*spre, secVsNifty=sg*(spre-npre) if spre==spre else np.nan, rsOR=sg*((c[4]/o[0]-1)*100-(N['c'][4]/N['o'][0]-1)*100),
          # J other
          vwapDist=sg*(e/vw-1)*100, prev1=sg*(cl[-1]/cl[-2]-1)*100, ret5=sg*(cl[-1]/cl[-6]-1)*100, ret20=sg*(cl[-1]/cl[-21]-1)*100,
          weekday=float(np.datetime64(day).astype(object).weekday()), expiry=float(bool(lb.get('expiry'))),
          # outcomes (from the entry price)
          mv5=mv(5),mv10=mv(10),mv15=mv(15),mv30=mv(30),mfe30=max(sg*((hi30 if sg==1 else lo30)/e-1)*100,0),mae30=min(sg*((lo30 if sg==1 else hi30)/e-1)*100,0),
          falseBO=int(min(back)<-0.3) if back else 0, clean15=clean, eodRight=int(sg*(c[359]-c[4])>0)))
    if fi%150==0: print(day,len(rows),flush=True)
json.dump(rows,open('e3-rows.json','w'),default=float)
print('rows',len(rows),'days',len({r['day'] for r in rows}))
