# ENTRY QUALITY of the direction test (owner 12 Nov 21:13): entry rule judged ALONE, exits ignored.
# For every trade entry: from the breakout (trigger) price at the entry time until 15:15, did the price go >= +1.5% / +2% our way BEFORE coming back
# to the entry price (tolerance 0.05%; strict 0% also shown)? Also: reached +1.5% at all (even after coming back).
# Tick days: real ticks. Old data: 1-minute bars (hint only); a bar that touches both is counted as 'came back first' (strict).
import json, glob, os, sys, numpy as np, pandas as pd, collections as C
TAGS=[t for t,_ in json.load(open('dirvars.json'))]
IST=19800
def judge(sg,e,path_hi,path_lo):
    # path arrays in time order (ticks: hi=lo=price). returns dict of flags
    fav=sg*((path_hi if sg==1 else path_lo)/e-1)*100; adv=sg*((path_lo if sg==1 else path_hi)/e-1)*100
    out={}
    for tol,tag in ((-0.05,''),(0.0,'s')):
        back=np.nonzero(adv<=tol)[0]; b=back[0] if len(back) else 10**9
        for x in (1.5,2.0):
            w=np.nonzero(fav>=x)[0]; w=w[0] if len(w) else 10**9
            out[f'c{x}{tag}']=int(w<b)   # same index (minute bar) -> b first (strict)
    out['any15']=int((fav>=1.5).any()) if len(fav) else 0
    return out
def summary(rows):
    n=len(rows)
    if not n: return 'n 0'
    a=lambda k: 100*np.mean([r[k] for r in rows])
    return f"entries {n:5} | clean >=1.5% {a('c1.5'):5.1f}% ({sum(r['c1.5'] for r in rows):4}) | clean >=2% {a('c2.0'):5.1f}% ({sum(r['c2.0'] for r in rows):4}) | strict 1.5% {a('c1.5s'):5.1f}% | reached 1.5% at all {a('any15'):5.1f}%"
mode=sys.argv[1]
if mode=='tick':
    days=['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06','2026-11-09','2026-11-12']
    R={t:[] for t in TAGS}
    for day in days:
        J=json.load(open(f'tickdir-{day}.json'))
        syms={x['sym'] for t in TAGS for x in J[t]['trades']}
        tf='/mnt/user-data/uploads/live-feed/data/ticks-2026-11-12.csv' if day=='2026-11-12' else f'tmp/to-{day}.csv'
        df=pd.read_csv(tf,usecols=['time','symbol','price']); df=df[df.symbol.isin(syms)&(df.price>0)&(df.time<'15:15:00')]
        df['s']=df.time.str.slice(0,2).astype(int)*3600+df.time.str.slice(3,5).astype(int)*60+df.time.str.slice(6).astype(float)
        G={s:g for s,g in df.groupby('symbol')}
        for t in TAGS:
            for x in J[t]['trades']:
                g=G[x['sym']]; s0=((x['inTs']/1000+IST)%86400); ss=g.s.to_numpy(); pp=g.price.to_numpy(); p=pp[ss>s0]
                trig=pp[np.searchsorted(ss,s0,side='right')-1]   # BASE = the breakout price (traded price at the entry moment), not our fill (ask+slippage, ~0.12% worse)
                sg=1 if x['dir']=='BUY' else -1
                R[t].append({**judge(sg,trig,p,p),'re':x.get('re',0),'day':day})
else:
    cache={}
    def bars(sym,day):
        y=day[:4]
        if (y,sym) not in cache:
            f=f'npz{y}/{sym}.npz'; cache[(y,sym)]=np.load(f) if os.path.exists(f) else None
        z=cache[(y,sym)]
        if z is None: return None
        d=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int)); t=z['t']; m=(t//1440==d)&(t%1440>=555)&(t%1440<=914)
        return t[m]%1440, z['h'][m].astype(float), z['l'][m].astype(float)
    R={t:[] for t in TAGS}
    for f in sorted(glob.glob('mdays2/20*-D0.json')):
        day=os.path.basename(f)[:10]
        for t in TAGS:
            D=json.load(open(f'mdays2/{day}-{t}.json')); P={p['sym']:p for p in D.get('picks') or []}
            for x in D.get('trades') or []:
                b=bars(x['sym'],day); pk=P.get(x['sym'])
                if b is None or pk is None: continue
                mm,h,l=b; orh=h[mm<560].max() if (mm<560).any() else None
                if not orh or not pk.get('high'): continue
                fct=orh/pk['high']                       # engine prices are NSE-official; minute file may be back-adjusted
                em=int(((x['inTs']//1000+IST)%86400)//60)
                k=mm>em; sg=1 if x['dir']=='BUY' else -1
                lvl=orh if sg==1 else l[mm<560].min()      # BASE = the breakout level (09:15-09:20 high/low) = trigger price
                R[t].append({**judge(sg,lvl,h[k],l[k]),'re':x.get('re',0),'day':day})
    json.dump({t:R[t] for t in TAGS},open('cleanq-old.json','w'))
for t in TAGS:
    print(f'{t:18} ALL {summary(R[t])}')
print()
for t in TAGS:
    print(f'{t:18} FIRST entries only {summary([r for r in R[t] if r["re"]==0])}')
if mode!='tick':
    print('\nPER YEAR (clean >=1.5% share of entries; tol 0.05%)')
    for t in TAGS:
        print(f'{t:18}',' | '.join(f"{y}: {100*np.mean([r['c1.5'] for r in R[t] if r['day'][:4]==y]):4.1f}% of {sum(1 for r in R[t] if r['day'][:4]==y)}" for y in ['2022','2023','2024','2025','2026']))
