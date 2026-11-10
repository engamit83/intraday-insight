# Minute-close inputs: one row per stock per minute (the price + day volume at the END of each minute), from ticks (A) and from Zerodha candles (B).
import csv,sys,glob,os,numpy as np,datetime as dt,collections as C
day=sys.argv[1]; H='time,symbol,price,day_volume,bid,bid_qty,offer,offer_qty\n'
def hm(m): return f'{m//60:02d}:{m%60:02d}'
# A: from ticks
last=C.OrderedDict(); opens={}
with open(f'tmp/to-{day}.csv') as f:
    r=csv.reader(f); next(r)
    for t,s,p,v,*_ in r:
        hh,mm=int(t[:2]),int(t[3:5]); m=hh*60+mm
        if s not in opens: opens[s]=(p,v)
        last[(m,s)]=(p,v)
rows=sorted(last.items())
with open(f'mc/A-{day}.csv','w') as o:
    o.write(H)
    for s,(p,v) in opens.items(): o.write(f'09:15:00.000,{s},{p},{v},{p},0,{p},0\n')
    for (m,s),(p,v) in rows:
        if 555<=m<=929: o.write(f'{hm(m)}:59.900,{s},{p},{v},{p},0,{p},0\n')
syms={s for s in opens}
# B: from Zerodha minute candles
dd=(np.datetime64(day)-np.datetime64('1970-01-01')).astype(int); out=[]; op=[]
for s in syms:
    f=f'npzlive/{s}.npz'
    if not os.path.exists(f): continue
    z=np.load(f); t=z['t']; m=(t//1440==dd)
    if not m.any(): continue
    md=t[m]%1440; c=z['c'][m]; v=np.cumsum(z['v'][m]); o_=z['o'][m]
    op.append(f'09:15:00.000,{s},{o_[0]:.2f},{int(z["v"][m][0])},{o_[0]:.2f},0,{o_[0]:.2f},0\n')
    for k in range(len(md)):
        if 555<=md[k]<=929: out.append((md[k],s,f'{hm(md[k])}:59.900,{s},{c[k]:.2f},{int(v[k])},{c[k]:.2f},0,{c[k]:.2f},0\n'))
out.sort()
with open(f'mc/B-{day}.csv','w') as o:
    o.write(H); o.writelines(op); o.writelines(x[2] for x in out)
print(day,'A rows',len(rows),'B rows',len(out),'syms',len(syms))
