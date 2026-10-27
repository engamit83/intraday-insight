# Build a gap-filled tick file for 27 Oct: recorded ticks + synthetic ticks (open, high/low in candle order, close) from Sharekhan 1-min history for 09:50-09:58.
import gzip,json,sys,csv
hist=json.load(gzip.open(sys.argv[1]))['results']; src=sys.argv[2]; out=sys.argv[3]; lo,hi='09:50','09:58'
syn=[]
for s,v in hist.items():
    for t,o,h,l,c,vol in (v.get('candles') or []):
        if not t.startswith('2026-10-27'): continue
        m=t[11:16]
        # Sharekhan 1-min stamps are bar END (e.g. 09:15:59 = bar 09:15) -> bar minute = m
        if lo<=m<=hi:
            path=[o,h,l,c] if c>=o else [o,l,h,c]
            for i,p in enumerate(path): syn.append((f"{m}:{5+i*15:02d}.000",s,p,vol))
syn.sort()
print('synthetic ticks',len(syn),'stocks',len({x[1] for x in syn}))
# cumulative volume: unknown in candles -> carry last recorded cum + candle volume share
rows=[r for r in csv.reader(open(src))]
head,body=rows[0],rows[1:]
lastcum={}
for r in body:
    if r[0][:5]<lo: lastcum[r[1]]=float(r[3] or 0)
add=[]; cum=dict(lastcum)
for t,s,p,vol in syn:
    cum[s]=cum.get(s,0)+vol/4
    add.append([t,s,str(p),str(int(cum[s])),str(p),'0',str(p),'0'])
allr=body+add; allr.sort(key=lambda r:r[0])
with open(out,'w',newline='') as f: w=csv.writer(f); w.writerow(head); w.writerows(allr)
print('written',len(allr))
