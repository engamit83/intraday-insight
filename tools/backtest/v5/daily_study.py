# Long daily study (Sharekhan daily candles, not adjusted for splits -> moves > 25% in a day are dropped). Last 3 years.
import gzip,json,numpy as np,collections,sys
d=json.load(gzip.open('/mnt/user-data/uploads/live-feed/data/history/hist-daily-2026-10-26.json.gz'))['results']
N50=open('n50.txt').read().split()[:49]
S={}
for s,v in d.items():
    c=[x for x in v.get('candles',[]) if x[0][:10]>='2023-07-01']
    if len(c)>60: S[s]={x[0][:10]:x[1:] for x in c}
days=sorted({k for v in S.values() for k in v if k>='2023-10-01'})
print('days',len(days),days[0],days[-1],'stocks',len(S))
rows=[]; X=[]
allk=sorted({k for v in S.values() for k in v})
idx={k:i for i,k in enumerate(allk)}
for dd in days:
    gaps=[];oc=[];pos=[];up=0;n=0
    for s,v in S.items():
        if dd not in v: continue
        i=idx[dd]; prev=None
        for j in range(i-1,max(i-6,-1),-1):
            if allk[j] in v: prev=v[allk[j]]; break
        if not prev: continue
        o,h,l,c,vol=v[dd]; pc=prev[3]
        if not (o>0 and pc>0) or abs(o/pc-1)>0.25 or abs(c/o-1)>0.25: continue
        g=(o/pc-1)*100; r=(c/o-1)*100
        if s in N50: gaps.append(g); oc.append(r); pos.append((c-l)/(h-l) if h>l else .5)
        n+=1; up+= c>o
        # stock-level for gap study: volume vs 20-day avg
        past=[v[allk[j]][4] for j in range(max(0,i-25),i) if allk[j] in v][-20:]
        if len(past)>=15 and np.mean(past)>0: X.append((dd,s,g,r,vol/np.mean(past),(c-l)/(h-l) if h>l else .5))
    if len(oc)<30: continue
    rows.append(dict(d=dd,gap=np.median(gaps),oc=np.mean(oc),pos=np.mean(pos),breadth=up/n*100))
R=rows
def typ(r):
    if abs(r['oc'])>=0.5 and ((r['oc']>0 and r['pos']>=0.65) or (r['oc']<0 and r['pos']<=0.35)): return 'TREND UP' if r['oc']>0 else 'TREND DOWN'
    if abs(r['oc'])<0.25: return 'FLAT / RANGE'
    return 'NORMAL UP' if r['oc']>0 else 'NORMAL DOWN'
cnt=collections.Counter(typ(r) for r in R)
print('\nDAY TYPES (Nifty-50 stocks average, open->close), last 3 years:')
for k,v in cnt.most_common(): print(f'  {k:<14} {v:>4} days {v/len(R)*100:4.0f}%')
print('\nGAP DAYS (median Nifty-50 stock gap): does the day go WITH the gap (gap-and-go) or AGAINST it (gap-fill)?')
for lo,hi in [(0.3,0.6),(0.6,1.0),(1.0,9)]:
    for sg,lab in [(1,'gap up'),(-1,'gap down')]:
        a=[r for r in R if lo<=r['gap']*sg<hi]
        if a: go=np.mean([r['oc']*sg>0 for r in a])*100; print(f"  {lab} {lo}-{hi}%: {len(a):>3} days, went WITH gap {go:3.0f}%, AGAINST {100-go:3.0f}%, avg open->close {np.mean([r['oc']*sg for r in a]):+.2f}% in gap direction")
print('\nSTOCKS IN PLAY (daily proxy: day volume >= 3x 20-day avg), open->close vs their own gap:')
for lo,hi,lab in [(-99,-3,'gap DOWN >3%'),(-3,-1,'gap DOWN 1-3%'),(-1,-0.3,'gap down 0.3-1%'),(-0.3,0.3,'no gap'),(0.3,1,'gap up 0.3-1%'),(1,3,'gap UP 1-3%'),(3,99,'gap UP >3%')]:
    a=[x for x in X if x[4]>=3 and lo<=abs(x[2])*np.sign(x[2])<hi]
    # direction = sign of gap; for 'no gap' use close direction share
    if not a: continue
    if lab=='no gap': print(f"  {lab:<42} n {len(a):>5}  closed up {np.mean([x[3]>0 for x in a])*100:3.0f}%"); continue
    cont=np.mean([np.sign(x[3])==np.sign(x[2]) for x in a])*100
    print(f"  {lab:<42} n {len(a):>5}  continued in gap direction {cont:3.0f}%  avg move in gap dir {np.mean([x[3]*np.sign(x[2]) for x in a]):+.2f}%")
print('\nNEXT DAY after a TREND day (does the trend carry on?):')
for t in ['TREND UP','TREND DOWN']:
    nx=[R[i+1] for i in range(len(R)-1) if typ(R[i])==t]; sg=1 if t=='TREND UP' else -1
    print(f"  after {t}: {len(nx)} days, next day same direction {np.mean([r['oc']*sg>0 for r in nx])*100:.0f}%, next-day gap same direction {np.mean([r['gap']*sg>0 for r in nx])*100:.0f}%")
json.dump(R,open('daily_days.json','w'))
