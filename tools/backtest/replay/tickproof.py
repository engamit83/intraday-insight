# DIRECTION TEST on LIVE TICK DAYS: same 16 variants (D0 = current rule), real recorded ticks.
import json, subprocess, os, csv
days=['2026-11-12','2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06','2026-11-09']
D='/mnt/user-data/uploads/live-feed/data/'
for day in days:
    out=f'tickproof-{day}.json'
    if os.path.exists(out): continue
    if day=='2026-11-12':
        b=json.load(open(D+'sip-baseline.json')); lc={}
        for r in csv.DictReader(open(D+'nse/2026-11-11/bhavdata.csv')):
            r={k.strip():v.strip() for k,v in r.items()}
            if r.get('SERIES') in ('EQ','BE','BZ'): lc[r['SYMBOL']]=float(r['CLOSE_PRICE'])
        b['lastClose']=lc; b['lastCloseDay']='2026-11-11'; bf='tmp/cb-2026-11-12.json'; json.dump(b,open(bf,'w')); tf=D+'ticks-2026-11-12.csv'
    else: bf=f'cb-{day}.json'; tf=f'tmp/to-{day}.csv'
    r=subprocess.run(['node','--max-old-space-size=3000','/home/claude/work/rpm.mjs',tf,bf,day,'proofvars.json','/home/claude/work/engdir/sip-engine.mjs'],capture_output=True,text=True,env={**os.environ,'SECT':'/home/claude/work/sectors.json'})
    open(out,'w').write(r.stdout); print(day,'done',len(r.stdout),r.stderr[-200:],flush=True)
