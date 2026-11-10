import gzip,json,numpy as np,os
H='/mnt/user-data/uploads/live-feed/data/history/'
d=json.load(gzip.open(H+'hist-1minute-2026-11-06.json.gz'))['results']
day='2026-11-03'; dd=(np.datetime64(day)-np.datetime64('1970-01-01')).astype(int)
st={'n':0,'c_eq':0,'o_eq':0,'o_eq_prevclose':0,'o_eq_prev_or_same':0,'c_eq_next':0}; diffc=[]
for s,it in list(d.items()):
    f=f'npzlive/{s}.npz'
    if not os.path.exists(f): continue
    z=np.load(f); idx={int(x):i for i,x in enumerate(z['t'])}
    for c in it.get('candles') or []:
        if c[0][:10]!=day: continue
        m=int(c[0][11:13])*60+int(c[0][14:16]); i=idx.get(dd*1440+m)
        if i is None or i==0 or m<=555 or m>=929: continue
        o,h,l,cl,v=c[1:6]; eq=lambda a,b: abs(a-b)<=0.051
        st['n']+=1; st['c_eq']+=eq(cl,z['c'][i]); st['o_eq']+=eq(o,z['o'][i]); st['o_eq_prevclose']+=eq(o,z['c'][i-1])
        st['o_eq_prev_or_same']+=eq(o,z['o'][i]) or eq(o,z['c'][i-1])
        diffc.append(abs(cl/z['c'][i]-1)*100)
x=np.array(diffc); print(st); print('close diff %: median',np.median(x),'p90',np.percentile(x,90),'p99',np.percentile(x,99),'share >0.1%',np.mean(x>0.1))
