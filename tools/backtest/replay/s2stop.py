# R3 family: SELL stocks-in-play at 09:20 whose 5-day rise >= T. Exit 15:14 or stop at +S% above entry (minute high touch, filled at stop price).
import json,numpy as np,collections as C,os
R=[r for r in json.load(open('s2rows.json')) if r['ret5']>=3.5]; COST=0.146
cache={}
def path(r):
    k=(r['day'],r['sym'])
    y=r['day'][:4]; z=cache.get((y,r['sym']))
    if z is None: z=cache[(y,r['sym'])]=np.load(f'npz{y}/{r["sym"]}.npz')
    dd=(np.datetime64(r['day'])-np.datetime64('1970-01-01')).astype(int)
    t=z['t']; m=(t//1440==dd); md=t[m]%1440
    s=(md>=561)&(md<=914); c=z['c'][m]
    e=float(c[md<=560][-1]); return e, z['h'][m][s], float(c[md<=914][-1])
for r in R: r['e'],r['hh'],r['x']=path(r)
Y=['2022','2023','2024','2025','2026']
def run(T,S):
    out={}
    for r in R:
        if r['ret5']<T: continue
        e=r['e']; ret=(e-r['x'])/e*100
        if S is not None:
            hit=np.nonzero(r['hh']>=e*(1+S/100))[0]
            if len(hit): ret=-S
        out.setdefault(r['day'],[]).append(ret-COST)
    return out
print('T=5d rise threshold, S=stop %; per year net after cost Rs (1 lakh/trade) | 22-24 | 25-26 | losing days% | worst day')
for T in [3.5,5,7.6,10]:
    for S in [None,1,1.5,2,3]:
        o=run(T,S); s=f'T{T:>4} S{str(S):>4}:'
        for y in Y: s+=f' {sum(sum(v) for d,v in o.items() if d[:4]==y)*1000:+8.0f}'
        for p,f in [('A',lambda d:d<'2025'),('B',lambda d:d>='2025')]:
            dv=[sum(v)*1000 for d,v in o.items() if f(d)]; n=sum(len(v) for d,v in o.items() if f(d))
            s+=f' | {p} {sum(dv):+8.0f} n{n} lose{100*np.mean(np.array(dv)<0):.0f}% worst{min(dv):+.0f}'
        print(s)
