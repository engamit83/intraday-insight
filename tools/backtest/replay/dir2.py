import json,glob,numpy as np,datetime as dt,collections as C
cache={}
def bars(y,s):
    if (y,s) not in cache:
        try: cache[(y,s)]=np.load(f'npz{y}/{s}.npz')
        except: cache[(y,s)]=None
    return cache[(y,s)]
def ts(day,h,m):
    d=dt.datetime.strptime(day,'%Y-%m-%d')+dt.timedelta(hours=h,minutes=m)
    return int(d.replace(tzinfo=dt.timezone.utc).timestamp()//60)
def px(z,t):
    i=np.searchsorted(z['t'],t,side='right')-1
    return float(z['c'][i]) if i>=0 else None
R=C.defaultdict(list)
COST=0.146
for f in sorted(glob.glob('mdays2/20*-S-RAW.json')):
    day=f[7:17]; y=day[:4]; d=json.load(open(f))
    for p in d['picks']:
        z=bars(y,p['sym']); g=p.get('gapWith')
        if z is None or g is None: continue
        a=px(z,ts(day,9,20)); b=px(z,ts(day,15,14))
        if not a or not b: continue
        mv=(b/a-1)*100
        gapup=(g>0)==(p['dir']=='BUY'); gap=abs(g)*(1 if gapup else -1)
        candle=1 if p['dir']=='BUY' else -1
        gs=1 if gap>0 else -1
        for per in [y,'22-24' if y<'2025' else '25-26']:
            R[(per,'candle')].append(candle*mv)
            R[(per,'gap')].append(gs*mv)
            R[(per,'agree')].append(candle*mv if candle==gs else np.nan)
            R[(per,'gap>=1%')].append(gs*mv if abs(gap)>=1 else np.nan)
            R[(per,'gap>=2%')].append(gs*mv if abs(gap)>=2 else np.nan)
print('hold 09:20->15:14, % move in signal direction; net = avg - 0.146% cost')
for k in ['candle','gap','agree','gap>=1%','gap>=2%']:
    s=k+': '
    for per in ['2022','2023','2024','2025','2026','22-24','25-26']:
        x=np.array(R[(per,k)]); x=x[~np.isnan(x)]
        if len(x): s+=f" {per} {100*(x>0).mean():.0f}%/{x.mean()-COST:+.2f}/n{len(x)} |"
    print(s)
