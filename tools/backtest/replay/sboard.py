# SHADOW SCOREBOARD (rule 0v). Every candidate on ALL tick days, from replay (= live) of the day's recorded ticks.
# E0 live BASE | X1 P8 keep 10% | X2 fast-drop exit at once | V9 filters  (engine replays, sb-DAY.json)
# F1 skip mixed 5-min path (tickdir count-0.2-skip) | D1 sells only after gap-up > 1% | C1 VWAP >= 0.84% at entry | C3 Thu/Fri  (filters on E0 entries)
# Entry quality = clean >=1.5% from the traded price at the entry moment (0.05% tolerance). Money = net after costs (engine).
import json, numpy as np, pandas as pd, sys
DAYS=sorted(set(sys.argv[1:]) or ['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06','2026-11-09','2026-11-12'])
D='/mnt/user-data/uploads/live-feed/data/'; LIVE={'2026-11-12':-2050}
def tickfile(day): return D+'ticks-2026-11-12.csv' if day=='2026-11-12' else f'tmp/to-{day}.csv'
T=[]
for day in DAYS:
    S=json.load(open(f'sb-{day}.json')); F=json.load(open(f'tickdir-{day}.json'))['count-0.2-skip']
    picks={p['sym']:p for p in S['E0']['picks']}
    syms={t['sym'] for k in S for t in S[k]['trades']}|{t['sym'] for t in F['trades']}
    df=pd.read_csv(tickfile(day),usecols=['time','symbol','price','day_volume']); df=df[df.symbol.isin(syms)&(df.price>0)&(df.time>='09:15:00')&(df.time<'15:15:00')]
    df['s']=df.time.str.slice(0,2).astype(int)*3600+df.time.str.slice(3,5).astype(int)*60+df.time.str.slice(6).astype(float)
    G={s:(g.s.to_numpy(),g.price.to_numpy(),np.nan_to_num(g.day_volume.to_numpy(float))) for s,g in df.groupby('symbol')}
    def judge(t):
        s,p,cv=G[t['sym']]; s0=(t['inTs']/1000+19800)%86400; k=np.searchsorted(s,s0,side='right')-1; e=p[k]; sg=1 if t['dir']=='BUY' else -1
        f=sg*(p[k+1:]/e-1)*100; b=np.nonzero(f<=-0.05)[0]; b=b[0] if len(b) else 10**9; w=np.nonzero(f>=1.5)[0]; w=w[0] if len(w) else 10**9
        dv=np.diff(cv[:k+1],prepend=cv[0]); dv[dv<0]=0; vw=(p[:k+1]*dv).sum()/dv.sum() if dv.sum()>0 else e
        return int(w<b), sg*(e/vw-1)*100
    for cand,trades in [(k,S[k]['trades']) for k in S]+[('F1',F['trades'])]:
        for t in trades:
            c,vd=judge(t); T.append(dict(day=day,cand=cand,sym=t['sym'],dir=t['dir'],re=t.get('re',0),net=t['net'],clean=c,vwapDist=vd,
                gapWith=picks.get(t['sym'],{}).get('gapWith')))
    print(day,'done',flush=True)
T=pd.DataFrame(T); E0=T[T.cand=='E0']
# filter candidates on E0 entries (a skipped stock also loses its re-entry)
def drop_stock(sel):
    bad=set(map(tuple,E0[~sel][E0[~sel].re==0][['day','sym']].values)); return E0[[ (d,s) not in bad for d,s in E0[['day','sym']].values ]]
d1=drop_stock(~((E0.dir=='SELL')&~(E0.gapWith.fillna(0)<=-1))); d1=d1.assign(cand='D1')
c1=drop_stock(E0.vwapDist>=0.84).assign(cand='C1')
c3=E0[pd.to_datetime(E0.day).dt.weekday>=3].assign(cand='C3')
A=pd.concat([T,d1,c1,c3])
def daily(c): x=A[A.cand==c].groupby('day').net.sum(); return np.array([x.get(d,0.0) for d in DAYS])
e0=daily('E0'); h=len(DAYS)//2
print(f'\nSHADOW SCOREBOARD - {len(DAYS)} tick days ({DAYS[0]} .. {DAYS[-1]}) [TICK]')
print(f'  replay = live check: ' + ', '.join(f'{d} replay {daily("E0")[DAYS.index(d)]:+.0f} vs live {v:+.0f}' for d,v in LIVE.items() if d in DAYS))
print(f"  {'cand':5} {'trades':>6} {'clean>=1.5%':>12} {'net Rs':>8} {'losing days':>11} {'worst day':>9} {'half1':>7} {'half2':>7} | vs E0: daily diff mean {'':>3} SE    t")
for c in ['E0','X1','X2','V9','F1','D1','C1','C3']:
    S=A[A.cand==c]; dn=daily(c); df_=dn-e0; se=df_.std(ddof=1)/np.sqrt(len(df_)) if len(df_)>1 else np.nan
    print(f"  {c:5} {len(S):6} {int(S.clean.sum()):5} ({100*S.clean.mean() if len(S) else 0:4.0f}%) {dn.sum():+8.0f} {int((dn<0).sum()):11} {dn.min():+9.0f} {dn[:h].sum():+7.0f} {dn[h:].sum():+7.0f} | {df_.mean():+8.0f} {se:6.0f} {df_.mean()/se if se else 0:+5.2f}")
A.to_csv('sboard-trades.csv',index=False)
