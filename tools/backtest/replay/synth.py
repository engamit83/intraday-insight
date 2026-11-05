# 1-min candles -> synthetic tick file in the feed's format (time,symbol,price,day_volume,bid,bid_qty,offer,offer_qty)
# per minute: open @:01, low/high @:20/:40 (order by candle colour), close @:58. Spread 0.02%. No order book.
import pickle,sys,json
bars=pickle.load(open('bars.pkl','rb')); day=sys.argv[1]; out=sys.argv[2]
B=dict(bars[day]); rows=[]
if 'NIFTY' not in B:  # Nifty proxy: equal-weight top-50 liquid stocks (corr 0.88 with the real Nifty on 29-30 Oct)
    import numpy as np; top=json.load(open('top50.json')); mins=sorted({k for s in top if s in B for k in B[s]}); N={}
    for k in mins:
        r=[B[s][k][3]/B[s][min(B[s])][0] for s in top if s in B and k in B[s]]; p=20000*float(np.mean(r)); N[k]=(p,p,p,p,0)
    B['NIFTY']=N
for s,m in B.items():
    cum=0; first=True
    for hm in sorted(m):
        if not('09:15'<=hm<='15:29'): continue
        o,h,l,c,v=m[hm]
        if first: rows.append((f'{hm}:00.500',s,o,0)); first=False
        seq=[(1,o),(20,l),(40,h),(58,c)] if c>=o else [(1,o),(20,h),(40,l),(58,c)]
        for i,(sec,p) in enumerate(seq):
            cum+=v/4; rows.append((f'{hm}:{sec:02d}.000',s,p,int(cum)))
rows.sort()
with open(out,'w') as f:
    f.write('time,symbol,price,day_volume,bid,bid_qty,offer,offer_qty\n')
    for t,s,p,cv in rows: f.write(f'{t},{s},{p},{cv},{p*(1-0.0001):.2f},0,{p*(1+0.0001):.2f},0\n')
print(day,len(rows))
