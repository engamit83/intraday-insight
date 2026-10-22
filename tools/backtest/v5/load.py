# Build one clean 1-minute dataset per day: data/DAY.pkl = {sym: np.array[[minute,o,h,l,c,v]]}, minute = minutes since 09:15
import json,csv,pickle,collections,os,numpy as np
os.makedirs('data',exist_ok=True)
def mm(hhmm): h,m=int(hhmm[:2]),int(hhmm[3:5]); return (h*60+m)-(9*60+15)
h=json.load(open('/home/claude/data/h500/hist500-1minute-2026-10-21.json'))['results']
byday=collections.defaultdict(dict)
for s,v in h.items():
    rows=collections.defaultdict(list)
    for t,o,hi,l,c,vol in v.get('candles') or []:
        d=t[:10]
        if d<'2026-10-12': continue
        rows[d].append([mm(t[11:16]),o,hi,l,c,vol])
    for d,r in rows.items():
        a=np.array(sorted(r)); a=a[(a[:,0]>=0)&(a[:,0]<375)]
        byday[d][s]=a
for d in ('19','21','22'):
    day=f'2026-10-{d}'; L=collections.defaultdict(list)
    for r in csv.DictReader(open(f'/mnt/user-data/uploads/live-feed/data/candles-{day}.csv')):
        L[r['symbol']].append([mm(r['time']),float(r['open']),float(r['high']),float(r['low']),float(r['close']),float(r['volume'])])
    for s,r in L.items():
        a=np.array(sorted(r)); a=a[(a[:,0]>=0)&(a[:,0]<375)]
        if day=='2026-10-19' and s in byday[day] and not s.startswith('NIFTY'): continue  # keep Sharekhan history for stocks on 19 Oct
        byday[day][s]=a
for d,x in sorted(byday.items()):
    pickle.dump(x,open(f'data/{d}.pkl','wb')); print(d,len(x),'NIFTY' in x)
