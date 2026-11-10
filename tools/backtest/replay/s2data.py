# Step 2 dataset: every S-RAW pick (stocks in play at 09:20), features KNOWN AT 09:20 + outcome (09:20->15:14 move %).
import json,glob,os,numpy as np,collections as C
L=json.load(open('labels920.json')); G=json.load(open('fac/global.json')); N=json.load(open('fac/news.json'))
SEC=json.load(open('/home/claude/work/sectors.json'))
NEWS=['results_meeting','board_other','results_filed','corp_action','filings','order','deal','rating','resign','fundraise','buyback','dividend','meet','press','board_outcome','ban']
cache={}
def daily(y,s):
    k=(y,s)
    if k in cache: return cache[k]
    out={}
    for yy in (str(int(y)-1),y):
        f=f'npz{yy}/{s}.npz'
        if not os.path.exists(f): continue
        z=np.load(f); t=z['t']; d=t//1440; md=t%1440
        for dd in np.unique(d):
            m=(d==dd); mm=md[m]
            if not ((mm>=555)&(mm<=929)).any(): continue
            c=z['c'][m]; h=z['h'][m]; l=z['l'][m]; o=z['o'][m]
            def at(k):
                i=np.searchsorted(mm,k,side='right')-1; return float(c[i]) if i>=0 else None
            out[int(dd)]=dict(o=float(o[0]),c=at(929),c920=at(560),c1514=at(914),h=float(h.max()),l=float(l.min()),
                             h920=float(h[mm<=559].max()) if (mm<=559).any() else None,l920=float(l[mm<=559].min()) if (mm<=559).any() else None)
    cache[k]=out; return out
rows=[]
for f in sorted(glob.glob('mdays2/20*-S-RAW.json')):
    day=os.path.basename(f)[:10]; y=day[:4]; d=json.load(open(f)); lb=L.get(day); g=G.get(day)
    if not lb or not g: continue
    dd=(np.datetime64(day)-np.datetime64('1970-01-01')).astype(int)
    picks=d['picks']
    for p in picks:
        D=daily(y,p['sym']); x=D.get(int(dd))
        if not x or not x['c920'] or not x['c1514']: continue
        prev=sorted(k for k in D if k<dd)
        if len(prev)<21: continue
        pc=D[prev[-1]]['c']; c20=[D[k]['c'] for k in prev[-20:]]; h20=max(D[k]['h'] for k in prev[-20:]); l20=min(D[k]['l'] for k in prev[-20:])
        nw=N.get(f'{day}|{p["sym"]}',{})
        r=dict(day=day,sym=p['sym'],sec=SEC.get(p['sym'],'other'),
            cand=(x['c920']/x['o']-1)*100, gap=(x['o']/pc-1)*100, rng5=(x['h920']-x['l920'])/x['o']*100,
            pos5=(x['c920']-x['l920'])/max(x['h920']-x['l920'],1e-9), rvol=p['rvol'],
            prev1=(pc/D[prev[-2]]['c']-1)*100, ret5=(pc/D[prev[-6]]['c']-1)*100, ret20=(pc/D[prev[-21]]['c']-1)*100,
            pos20=(x['c920']-l20)/max(h20-l20,1e-9), prevrng=(D[prev[-1]]['h']-D[prev[-1]]['l'])/pc*100,
            ngap=lb['gap'],ndrive=lb['drive'],breadth=lb['breadth'],vix=lb['vix'],vixchg=lb['vixchg'],nprev=lb['prev_move'],
            wd=lb['weekday'],exp=int(lb['expiry']),mexp=int(lb['monthly_expiry']),
            npicks=len(picks),pickbuy=sum(q['dir']=='BUY' for q in picks)/len(picks),
            out=(x['c1514']/x['c920']-1)*100)
        for k,v in g.items(): r['g_'+k]=v
        for k in NEWS: r['n_'+k]=nw.get(k,0)
        r['n_any']=int(bool(nw))
        rows.append(r)
# sector move at 09:20 among picks of same day (leave-one-out)
by=C.defaultdict(list)
for i,r in enumerate(rows): by[(r['day'],r['sec'])].append(i)
for k,ix in by.items():
    for i in ix:
        o=[rows[j]['cand'] for j in ix if j!=i]; rows[i]['secpk']=float(np.mean(o)) if o else 0.0
json.dump(rows,open('s2rows.json','w'))
print(len(rows),'rows', C.Counter(r['day'][:4] for r in rows))
