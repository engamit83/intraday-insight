# 60-min study (36 days, 1 Sep-23 Oct): breadth at 10:15 (share of liquid stocks whose first-hour close > day open) vs rest of day.
import gzip,json,numpy as np,collections,search
d=json.load(gzip.open('/mnt/user-data/uploads/live-feed/data/history/hist-60minute-2026-10-26.json.gz'))['results']
N50=open('n50.txt').read().split()[:49]
by=collections.defaultdict(dict)
for s,v in d.items():
    if 'candles' not in v or search.liq.get(s,0)<25: continue
    for c in v['candles']:
        by[c[0][:10]].setdefault(s,[]).append(c)
rows=[]
for day in sorted(by):
    st=by[day]; br=[];rest=[];n50=[];fh=[]
    for s,c in st.items():
        c=sorted(c)
        if len(c)<6 or not c[0][0][11:16].startswith('10:1'): continue
        o=c[0][1]; h1=c[0][4]; cl=c[-1][4]
        br.append(h1>o); r1=(h1/o-1)*100; r2=(cl/h1-1)*100
        rest.append((s,r1,r2))
        if s in N50: n50.append((r1,r2,(cl/o-1)*100))
    if len(br)<100 or len(n50)<30: continue
    B=np.mean(br)*100; a=np.array(n50)
    # stock-level: after 10:15, stocks that moved WITH breadth in the first hour vs AGAINST
    sg=1 if B>=50 else -1
    withb=[x[2]*sg for x in rest if x[1]*sg>0]; against=[x[2]*sg for x in rest if x[1]*sg<0]
    strong=[x[2]*np.sign(x[1]) for x in rest if abs(x[1])>=1.5]  # first-hour movers >=1.5%: continue after 10:15?
    rows.append(dict(d=day,B=B,first=a[:,0].mean(),rest=a[:,1].mean(),day=a[:,2].mean(),withb=np.mean(withb),against=np.mean(against),strong=np.mean(strong) if strong else np.nan,nstrong=len(strong)))
print('days',len(rows))
for lo,hi,lab in [(0,25,'breadth <25% (strong sellers)'),(25,40,'25-40%'),(40,60,'40-60% (mixed)'),(60,75,'60-75%'),(75,101,'>75% (strong buyers)')]:
    a=[r for r in rows if lo<=r['B']<hi]
    if not a: continue
    sg=-1 if hi<=40 else (1 if lo>=60 else 0)
    same=np.mean([np.sign(r['rest'])==np.sign(r['B']-50) for r in a])*100
    print(f"{lab:<30} {len(a):>2} days | Nifty-50 after 10:15 avg {np.mean([r['rest'] for r in a]):+.2f}%, continued breadth direction {same:3.0f}% of days | "
          f"stocks WITH breadth after 10:15 {np.mean([r['withb'] for r in a]):+.2f}% vs AGAINST {np.mean([r['against'] for r in a]):+.2f}% (in breadth direction)")
print(f"ALL days: first-hour movers >=1.5% kept going after 10:15 by avg {np.nanmean([r['strong'] for r in rows]):+.2f}% (n {sum(r['nstrong'] for r in rows)})")
for r in rows[-12:]: print(r['d'][5:],f"breadth10:15 {r['B']:3.0f}% first hr {r['first']:+.2f}% rest {r['rest']:+.2f}% day {r['day']:+.2f}%")
