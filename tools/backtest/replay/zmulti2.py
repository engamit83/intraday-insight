# zreplay.py - replay the REAL live engine over every day of Zerodha 1-min history (owner 8 Nov plan, step 2).
# Per day: no-look-ahead baseline from the previous 10 days (first-5-min volume, traded value, yesterday's close + its day, yesterday's move),
# pass 1 = 09:15-09:21 ticks of all liquid stocks -> the engine's 09:20 picks; pass 2 = liquid stocks until 10:15 (breadth, entries) +
# the picks and NIFTY all day on a SMOOTH path (6 steps per leg; calibrated on our tick days). Output: days/<DAY>-<variant>.json
# Usage: python3 zreplay.py NPZDIR [variant_json] [tag] [first_day] [last_day]
import sys,os,json,glob,subprocess,numpy as np,datetime as dt
NPZ=sys.argv[1]; VARS=json.load(open(sys.argv[2])); TAG=sys.argv[3] if len(sys.argv)>3 else 'M'
D0=sys.argv[4] if len(sys.argv)>4 else '0000'; D1=sys.argv[5] if len(sys.argv)>5 else '9999'
ENG='/home/claude/intraday-insight/tools/live-feed/sip-engine.mjs'; RP='/home/claude/work/rp.mjs'
os.makedirs('days',exist_ok=True); os.makedirs('mdays2',exist_ok=True); os.makedirs('tmp',exist_ok=True)
IST=0  # Kite times are already IST (naive)
def load():
    S={}
    for f in sorted(glob.glob(NPZ+'/*.npz')):
        z=np.load(f); t=z['t']+IST   # IST minutes
        S[os.path.basename(f)[:-4]]=(t,z['o'],z['h'],z['l'],z['c'],z['v'])
    return S
S=load()
# per stock per day: first-5 volume, close, traded value (Rs cr)
day_of=lambda t:(t//1440)
stats={}; alldays=set()
for s,(t,o,h,l,c,v) in S.items():
    d=day_of(t); md=t%1440
    for dd in np.unique(d):
        m=d==dd; mm=md[m]
        if not ((mm>=555)&(mm<=929)).any(): continue
        f5=v[m][(mm>=555)&(mm<=559)].sum(); cl=c[m][mm<=929][-1] if (mm<=929).any() else c[m][-1]
        tv=float((c[m]*v[m]).sum()/1e7)
        stats.setdefault(int(dd),{})[s]=(float(f5),float(cl),tv); alldays.add(int(dd))

BHAV={}
import csv
with open('/mnt/user-data/uploads/live-feed/data/history-news/bhav-compact.csv') as fh:
    r=csv.reader(fh); next(r)
    for d_,sym,cl,pc,tv,dp in r:
        try: BHAV.setdefault((dt.date.fromisoformat(d_)-dt.date(1970,1,1)).days,{})[sym]=(float(cl),float(tv),float(pc))
        except ValueError: pass
print('bhav days',len(BHAV),file=sys.stderr)
days=sorted(d for d in alldays if (d+3)%7<5)  # Mon-Fri only (1970-01-01 was a Thursday)
# use OFFICIAL close + turnover where NSE file exists (same inputs as live)
for dd in days:
    if dd in BHAV:
        for s,(f5,cl,tv) in list(stats[dd].items()):
            if s in BHAV[dd]: stats[dd][s]=(f5,BHAV[dd][s][0],BHAV[dd][s][1])

dname=lambda dd:(dt.date(1970,1,1)+dt.timedelta(days=dd)).isoformat()
def baseline(i):
    prev=days[max(0,i-10):i]; b={'first5':{},'turnover':{},'lastClose':{},'prevMove':{},'days':[dname(x) for x in prev],'lastCloseDay':dname(prev[-1])}
    for s in S:
        f=[stats[x][s][0] for x in prev if s in stats[x] and stats[x][s][0]>0]
        tv=[stats[x][s][2] for x in prev if s in stats[x]]
        if f: b['first5'][s]=f
        if tv: b['turnover'][s]=tv
        if s in stats[prev[-1]]:
            b['lastClose'][s]=stats[prev[-1]][s][1]
            if len(prev)>1 and s in stats[prev[-2]] and stats[prev[-2]][s][1]>0: b['prevMove'][s]=round((stats[prev[-1]][s][1]/stats[prev[-2]][s][1]-1)*100,2)
    if days[i] in BHAV:
        for s_,(cl_,tv_,pc_) in BHAV[days[i]].items():
            if s_ in S and pc_>0: b['lastClose'][s_]=pc_
    return b
def liquid(b): return {s for s,v in b['turnover'].items() if np.median(v)>=25}
def write_ticks(path,dd,syms,smooth,until,nifty_proxy):
    rows=[]
    for s in syms:
        t,o,h,l,c,v=S[s]; m=(t//1440==dd); tt=t[m]%1440; O,H,L,C,V=o[m],h[m],l[m],c[m],v[m]
        cum=0; first=True; sm=s in smooth or s=='NIFTY'
        for k in range(len(tt)):
            mm=int(tt[k])
            if mm<555 or mm>929: continue
            if mm>until and not sm: break
            hm=f'{mm//60:02d}:{mm%60:02d}'
            if first: rows.append((f'{hm}:00.500',s,float(O[k]),0)); first=False
            hi_first=C[k]<O[k]; pts=[O[k],H[k],L[k],C[k]] if hi_first else [O[k],L[k],H[k],C[k]]
            if sm:
                pth=[pts[0]]+[pts[i]+(pts[i+1]-pts[i])*j/6 for i in range(3) for j in range(1,7)]
                for j,p in enumerate(pth): cum+=V[k]/len(pth); rows.append((f'{hm}:{int(1+56*j/(len(pth)-1)):02d}.{j:03d}',s,round(float(p),2),int(cum)))
            else:
                for sec,p in zip((1,20,40,58),pts): cum+=V[k]/4; rows.append((f'{hm}:{sec:02d}.000',s,float(p),int(cum)))
    rows.sort()
    with open(path,'w') as f:
        f.write('time,symbol,price,day_volume,bid,bid_qty,offer,offer_qty\n')
        for t_,s,p,cv in rows: f.write(f'{t_},{s},{p},{cv},{p*(1-0.0001):.2f},0,{p*(1+0.0001):.2f},0\n')
def run(ticks,bf,day,vf):
    out=subprocess.run(['node','--max-old-space-size=3000','/home/claude/work/rpm.mjs',ticks,bf,day,vf,ENG],capture_output=True,text=True,env={**os.environ,'SECT':'/home/claude/work/sectors.json'})
    return json.loads(out.stdout) if out.stdout.strip() else {'__error':out.stderr[-500:]}
vf=f'tmp/vars-{TAG}.json'; json.dump(VARS,open(vf,'w'))
for i,dd in enumerate(days):
    day=dname(dd)
    if i<2 or not(D0<=day<=D1): continue
    todo=[[t,o] for t,o in VARS if not os.path.exists(f'mdays2/{day}-{t}.json')]
    if not todo: continue
    json.dump(todo,open(vf,'w'))
    b=baseline(i); liq=sorted(liquid(b)&set(S)); bf=f'tmp/b-{day}-{TAG}.json'; json.dump(b,open(bf,'w'))
    syms=liq+(['NIFTY'] if 'NIFTY' in S else [])
    p1=f'tmp/p1-{day}-{TAG}.csv'; p2=f'tmp/p2-{day}-{TAG}.csv'
    write_ticks(p1,dd,syms,set(),561,False)
    r1=run(p1,bf,day,vf)
    if '__error' in r1: print(day,'ERR',r1['__error'][-200:],flush=True); continue
    picks=set(p['sym'] for r in r1.values() for p in (r.get('picks') or []))
    write_ticks(p2,dd,syms,picks,615,False)
    r2=run(p2,bf,day,vf)
    if '__error' in r2: print(day,'ERR',r2['__error'][-200:],flush=True); continue
    for t,r in r2.items():
        json.dump({'day':day,'liquid':len(liq),'picks':r.get('picks'),'sum':r.get('sum'),'trades':r.get('trades')},open(f'mdays2/{day}-{t}.json','w'))
    for f in (p1,p2,bf): os.remove(f)
    print(day,'ok',len(r2),flush=True)
