import json, pandas as pd, numpy as np, collections as C
days=['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06','2026-11-09','2026-11-12']
TAGS=[t for t,_ in json.load(open('dirvars.json'))]
R={t:dict(day=[],tr=[],acc=[]) for t in TAGS}
for day in days:
    J=json.load(open(f'tickdir-{day}.json'))
    syms={p['sym'] for t in TAGS for p in (J[t]['picks'] or [])}
    tf='/mnt/user-data/uploads/live-feed/data/ticks-2026-11-12.csv' if day=='2026-11-12' else f'tmp/to-{day}.csv'
    df=pd.read_csv(tf,usecols=['time','symbol','price']); df=df[df.symbol.isin(syms)&(df.price>0)]
    a=df[df.time<'09:21:00'].groupby('symbol').price.last(); b=df[df.time<'15:15:00'].groupby('symbol').price.last()
    for t in TAGS:
        tr=J[t]['trades']; R[t]['day'].append(sum(x['net'] for x in tr)); R[t]['tr']+=[x['net'] for x in tr]
        for p in J[t]['picks'] or []:
            if p['dir'] in ('BUY','SELL') and p['sym'] in a and p['sym'] in b and a[p['sym']]!=b[p['sym']]:
                R[t]['acc'].append(int((b[p['sym']]>a[p['sym']])==(p['dir']=='BUY')))
print(f"{'version':18} trades  net Rs   losing days  worst day  win%   side right (09:20->15:14)")
for t in TAGS:
    d=np.array(R[t]['day']); n=np.array(R[t]['tr'])
    print(f"{t:18} {len(n):5} {d.sum():+8.0f}   {int((d<0).sum()):5}      {d.min():+7.0f}   {100*np.mean(n>0) if len(n) else 0:4.0f}%   {100*np.mean(R[t]['acc']):4.1f}% of {len(R[t]['acc'])}")
print('per day net, D0 vs each:'); 
for t in TAGS: print(f"{t:18}",' '.join(f'{x:+6.0f}' for x in R[t]['day']))
