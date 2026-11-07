# Many-paths replay: like synth.py, but for the day's PICKED stocks the order of high/low inside each minute is random (seeded).
# Other stocks keep the default path until 10:15 (breadth, picks), then are dropped (no entries after 10:15). NIFTY kept all day.
import pickle,sys,json,random
day,seed,out,picks=sys.argv[1],int(sys.argv[2]),sys.argv[3],set(json.loads(sys.argv[4]))
bars=pickle.load(open('bars.pkl','rb')); B=dict(bars[day]); rng=random.Random(seed); rows=[]
if 'NIFTY' not in B:
    import numpy as np; top=json.load(open('top50.json')); mins=sorted({k for s in top if s in B for k in B[s]}); N={}
    for k in mins:
        r=[B[s][k][3]/B[s][min(B[s])][0] for s in top if s in B and k in B[s]]; p=20000*float(np.mean(r)); N[k]=(p,p,p,p,0)
    B['NIFTY']=N
for s,m in B.items():
    cum=0; first=True; rand=s in picks
    for hm in sorted(m):
        if not('09:15'<=hm<='15:29'): continue
        if hm>'10:15' and not rand and s!='NIFTY': break
        o,h,l,c,v=m[hm]
        if first: rows.append((f'{hm}:00.500',s,o,0)); first=False
        hi_first = (rng.random()<0.5) if rand else (c<o)
        seq=[(1,o),(20,h),(40,l),(58,c)] if hi_first else [(1,o),(20,l),(40,h),(58,c)]
        for sec,p in seq: cum+=v/4; rows.append((f'{hm}:{sec:02d}.000',s,p,int(cum)))
rows.sort()
with open(out,'w') as f:
    f.write('time,symbol,price,day_volume,bid,bid_qty,offer,offer_qty\n')
    for t,s,p,cv in rows: f.write(f'{t},{s},{p},{cv},{p*(1-0.0001):.2f},0,{p*(1+0.0001):.2f},0\n')
