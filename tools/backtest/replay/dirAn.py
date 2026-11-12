# DIRECTION TEST (owner 12 Nov 17:51-17:57): full BASE rules, ONLY step 2 (direction) changed. D0 = current rule (09:20 price vs open).
# PASS MARK (written before results): in EVERY walk-forward test year (2024, 2025, 2026) the side is right clearly more than D0 / 49%,
# AND net after costs beats D0. Walk-forward: the band/unclear setting of each method is chosen on the earlier years only.
import json, glob, os, sys, numpy as np, collections as C
TAGS=[t for t,_ in json.load(open('dirvars.json'))]
cache={}
def px(sym,day,mm):
    y=day[:4]
    if (y,sym) not in cache:
        f=f'npz{y}/{sym}.npz'; cache[(y,sym)]=np.load(f) if os.path.exists(f) else None
    z=cache[(y,sym)]
    if z is None: return None
    d=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int)); t=z['t']; i=np.searchsorted(t,d*1440+mm,side='right')-1
    return float(z['c'][i]) if i>=0 and t[i]//1440==d else None
S={t:C.defaultdict(lambda: dict(net=[],day=[],acc=[],n=0)) for t in TAGS}
days=sorted({os.path.basename(f)[:10] for f in glob.glob('mdays2/20*-D0.json')})
for day in days:
    y=int(day[:4])
    for t in TAGS:
        f=f'mdays2/{day}-{t}.json'
        if not os.path.exists(f): continue
        D=json.load(open(f)); s=S[t][y]; dn=sum(x['net'] for x in D.get('trades') or [])
        s['day'].append(dn); s['net']+= [x['net'] for x in D.get('trades') or []]
        for p in D.get('picks') or []:
            if p['dir'] not in ('BUY','SELL'): continue
            a=px(p['sym'],day,560); b=px(p['sym'],day,914)
            if a and b and a!=b: s['acc'].append(int((b>a)==(p['dir']=='BUY')))
def M(s):
    n=np.array(s['net']); d=np.array(s['day'])
    return dict(days=len(d),tr=len(n),net=n.sum(),win=100*np.mean(n>0) if len(n) else 0,lose=int((d<0).sum()),worst=d.min() if len(d) else 0,acc=100*np.mean(s['acc']) if s['acc'] else 0,nacc=len(s['acc']))
YRS=sorted({y for t in TAGS for y in S[t]})
print('PER YEAR (net Rs after costs | losing days | worst day | side right % of 09:20 picks [n])')
for t in TAGS:
    print(f'{t:18}'+' | '.join(f"{y}: {M(S[t][y])['net']:+8.0f} L{M(S[t][y])['lose']:3} w{M(S[t][y])['worst']:+6.0f} {M(S[t][y])['acc']:4.1f}%[{M(S[t][y])['nacc']}]" for y in YRS))
print('\nWALK-FORWARD: per method the setting with the best net on the EARLIER years only, then judged on the test year vs D0')
for m in ['count','avg','vwap']:
    vs=[t for t in TAGS if t.startswith(m)]
    for ty in [y for y in (2024,2025,2026) if y in YRS]:
        tr=[y for y in YRS if y<ty]
        best=max(vs,key=lambda t: sum(M(S[t][y])['net'] for y in tr))
        a=M(S[best][ty]); b=M(S['D0'][ty])
        ok=a['acc']>b['acc'] and a['net']>b['net']
        print(f"  {m:5} test {ty}: chose {best:16} | net {a['net']:+8.0f} vs D0 {b['net']:+8.0f} | side right {a['acc']:.1f}% vs {b['acc']:.1f}% | losing days {a['lose']} vs {b['lose']} | trades {a['tr']} vs {b['tr']} | {'BETTER' if ok else 'not better'}")
