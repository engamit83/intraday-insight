# Real Nifty index daily (Sharekhan, since 2000): day types, gap behaviour, day-after effects. Periods: last 3 years and last 10 years.
import gzip,json,numpy as np,collections
c=json.load(gzip.open('/mnt/user-data/uploads/live-feed/data/history/idx-daily-2026-10-27.json.gz'))['results']['NIFTY']['candles']
c=[(x[0][:10],x[1],x[2],x[3],x[4]) for x in c]
def study(since,label):
    R=[]
    for i in range(1,len(c)):
        d,o,h,l,cl=c[i]
        if d<since: continue
        pc=c[i-1][4]; gap=(o/pc-1)*100; oc=(cl/o-1)*100; pos=(cl-l)/(h-l) if h>l else .5; rng=(h-l)/o*100
        t='TREND UP' if oc>=0.5 and pos>=0.75 else 'TREND DOWN' if oc<=-0.5 and pos<=0.25 else 'FLAT/RANGE' if abs(oc)<0.25 else ('NORMAL UP' if oc>0 else 'NORMAL DOWN')
        R.append(dict(d=d,gap=gap,oc=oc,pos=pos,rng=rng,t=t))
    print(f"\n=== REAL NIFTY {label}: {len(R)} days ({R[0]['d']}..{R[-1]['d']}) ===")
    for k,v in collections.Counter(r['t'] for r in R).most_common(): print(f"  {k:<12} {v:>5} {v/len(R)*100:4.0f}%")
    for lo,hi in [(0.2,0.5),(0.5,1),(1,9)]:
        for sg,lab in [(1,'gap UP'),(-1,'gap DOWN')]:
            a=[r for r in R if lo<=r['gap']*sg<hi]
            if a: print(f"  {lab} {lo}-{hi}%: {len(a):>4} days, day went WITH gap {np.mean([r['oc']*sg>0 for r in a])*100:3.0f}%, avg open->close in gap dir {np.mean([r['oc']*sg for r in a]):+.2f}%")
    for t in ['TREND UP','TREND DOWN']:
        nx=[R[i+1] for i in range(len(R)-1) if R[i]['t']==t]; sg=1 if 'UP' in t else -1
        print(f"  after {t}: next day same direction {np.mean([r['oc']*sg>0 for r in nx])*100:.0f}% (n {len(nx)}), next gap same direction {np.mean([r['gap']*sg>0 for r in nx])*100:.0f}%")
    big=[r for r in R if r['rng']>=1.5]; print(f"  wide-range days (>=1.5%): {len(big)} ({len(big)/len(R)*100:.0f}%), of them trend days {np.mean([r['t'].startswith('TREND') for r in big])*100:.0f}%")
study('2023-10-01','last 3 years'); study('2016-10-01','last 10 years')
