import json,subprocess,os,concurrent.futures as cf
U='/mnt/user-data/uploads/live-feed/data/'
D={**{d:(U+f'ticks-2026-10-{d}.csv',f'base{d}.json',f'2026-10-{d}',U+f'book-2026-10-{d}.csv') for d in ['22','23','26','27','28','29','30']},
   **{'n'+d:(f'syn-n{d}.csv',f'base{d}n.json',f'2026-11-{d}','none') for d in ['02','03','04']}}
V={'A today (P8 on)':{},'1a stop at middle of range':{'stopMid':True},'1b skip range > 2%':{'maxRangePct':2},'1c skip range > 3%':{'maxRangePct':3},
   '1d wider stop max 2%':{'stopMaxPct':2},'1e tighter stop max 1%':{'stopMaxPct':1},
   '2a market 5-min against -> half size':{'mktDisHalf':True},'2b market 5-min against -> skip':{'mktDisSkip':True},
   '3a stock >=1% stronger than Nifty':{'proveRs':1},'3b stock >=0.5% stronger than Nifty':{'proveRs':0.5}}
os.makedirs('g',exist_ok=True)
def run(n,d):
    f=f"g/{list(V).index(n)}-{d}.json"
    if not os.path.exists(f) or os.path.getsize(f)==0:
        t,b,day,bk=D[d]; out=subprocess.run(['node','rp.mjs',t,b,day,bk,json.dumps(V[n])],capture_output=True,text=True)
        open(f,'w').write(out.stdout)
    return f
with cf.ThreadPoolExecutor(3) as ex: list(ex.map(lambda a:run(*a),[(n,d) for n in V for d in D]))
print('done')
