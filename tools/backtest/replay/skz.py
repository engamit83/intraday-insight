# Sharekhan official 1-min candles vs Zerodha 1-min candles, minute by minute (same stock, same minute).
import gzip,json,numpy as np,collections as C,os,datetime as dt
H='/mnt/user-data/uploads/live-feed/data/history/'
SK={}
for f in ['hist-1minute-2026-10-23.json.gz','hist-1minute-2026-10-27.json.gz','hist-1minute-2026-11-06.json.gz']:
    d=json.load(gzip.open(H+f))['results']
    for s,it in d.items():
        for c in it.get('candles') or []:
            day=c[0][:10]; m=int(c[0][11:13])*60+int(c[0][14:16]); SK[(s,day,m)]=c[1:6]
print('sharekhan candles',len(SK))
days=sorted({k[1] for k in SK}); res=C.defaultdict(lambda: C.Counter()); vr=C.defaultdict(list)
syms=sorted({k[0] for k in SK})
for s in syms:
    f=f'npzlive/{s}.npz'
    if not os.path.exists(f): continue
    z=np.load(f); t=z['t']
    idx={int(x):i for i,x in enumerate(t)}
    for day in days:
        dd=(np.datetime64(day)-np.datetime64('1970-01-01')).astype(int)
        for m in range(555,930):
            k=(s,day,m)
            if k not in SK: continue
            i=idx.get(dd*1440+m)
            if i is None: res[day]['missingZ']+=1; continue
            o,h,l,c,v=SK[k]; zo,zh,zl,zc,zv=z['o'][i],z['h'][i],z['l'][i],z['c'][i],z['v'][i]
            R=res[day]; R['n']+=1
            eq=lambda a,b: abs(a-b)<=max(0.051,1e-6*b)
            R['close']+=eq(c,zc); R['open']+=eq(o,zo); R['high']+=eq(h,zh); R['low']+=eq(l,zl); R['all4']+=eq(c,zc) and eq(o,zo) and eq(h,zh) and eq(l,zl)
            if zv>0: vr[day].append(v/zv)
print(f"{'day':11} {'minutes':>8} {'close=':>7} {'open=':>6} {'high=':>6} {'low=':>6} {'all4=':>6}  vol SK/Z median (p10-p90)")
for day in days:
    R=res[day]; n=max(R['n'],1); x=np.array(vr[day]) if vr[day] else np.array([0])
    print(f"{day} {R['n']:8} {100*R['close']/n:6.1f}% {100*R['open']/n:5.1f}% {100*R['high']/n:5.1f}% {100*R['low']/n:5.1f}% {100*R['all4']/n:5.1f}%  {np.median(x):.3f} ({np.percentile(x,10):.3f}-{np.percentile(x,90):.3f})  missingZ {R['missingZ']}")
