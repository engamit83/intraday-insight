# zreplay.py - replay the REAL live engine over every day of Zerodha 1-min history (owner 8 Nov plan, step 2).
# Per day: no-look-ahead baseline from the previous 10 days (first-5-min volume, traded value, yesterday's close + its day, yesterday's move),
# pass 1 = 09:15-09:21 ticks of all liquid stocks -> the engine's 09:20 picks; pass 2 = liquid stocks until 10:15 (breadth, entries) +
# the picks and NIFTY all day on a SMOOTH path (6 steps per leg; calibrated on our tick days). Output: days/<DAY>-<variant>.json
# Usage: python3 zreplay.py NPZDIR [variant_json] [tag] [first_day] [last_day]
import sys,os,json,glob,subprocess,numpy as np,datetime as dt
NPZ=sys.argv[1]; OVER=sys.argv[2] if len(sys.argv)>2 else '{}'; TAG=sys.argv[3] if len(sys.argv)>3 else 'A'
D0=sys.argv[4] if len(sys.argv)>4 else '0000'; D1=sys.argv[5] if len(sys.argv)>5 else '9999'
ENG='/home/claude/intraday-insight/tools/live-feed/sip-engine.mjs'; RP='/home/claude/work/rp.mjs'
os.makedirs('days',exist_ok=True); os.makedirs('tmp',exist_ok=True)
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
days=sorted(alldays)
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
def run(ticks,bf,day,over):
    out=subprocess.run(['node',RP,ticks,bf,day,'none',over,ENG],capture_output=True,text=True,env={**os.environ,'SECT':'/home/claude/work/sectors.json'})
    return json.loads(out.stdout) if out.stdout.strip() else {'error':out.stderr[-500:]}
for i,dd in enumerate(days):
    day=dname(dd)
    if i<2 or not(D0<=day<=D1): continue
    of=f'days/{day}-{TAG}.json'
    if os.path.exists(of): continue
    b=baseline(i); liq=sorted(liquid(b)&set(S)); bf=f'tmp/b-{day}-{TAG}.json'; json.dump(b,open(bf,'w'))
    syms=liq+(['NIFTY'] if 'NIFTY' in S else [])
    write_ticks(f'tmp/p1-{day}-{TAG}.csv',dd,syms,set(),561,False)
    r1=run(f'tmp/p1-{day}-{TAG}.csv',bf,day,OVER); picks=[p['sym'] for p in r1.get('picks') or []]
    write_ticks(f'tmp/p2-{day}-{TAG}.csv',dd,syms,set(picks),615,False)
    r2=run(f'tmp/p2-{day}-{TAG}.csv',bf,day,OVER)
    json.dump({'day':day,'liquid':len(liq),'picks':r2.get('picks'),'sum':r2.get('sum'),'trades':r2.get('trades'),'error':r2.get('error')},open(of,'w'))
    for f in (f'tmp/p1-{day}-{TAG}.csv',f'tmp/p2-{day}-{TAG}.csv'): os.remove(f)
    print(day,'liquid',len(liq),'net',(r2.get('sum') or {}).get('net'),'trades',len(r2.get('trades') or []),flush=True)
