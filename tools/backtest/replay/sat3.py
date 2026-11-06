import json,subprocess,os,concurrent.futures as cf
U='/mnt/user-data/uploads/live-feed/data/'
D={}
for d in ['22','23','26','27','28','29','30']: D[d]=(U+f'ticks-2026-10-{d}.csv',f'B-2026-10-{d}.json',f'2026-10-{d}',U+f'book-2026-10-{d}.csv',U+f'preopen-2026-10-{d}.csv')
D['06']=(U+'ticks-2026-11-06.csv','B-2026-11-06.json','2026-11-06',U+'book-2026-11-06.csv',U+'preopen-2026-11-06.csv')
for d in ['13','14','15','16','19','21']: D['o'+d]=(f'syn-o{d}.csv',f'B-2026-10-{d}.json',f'2026-10-{d}','none','')
for d in ['02','03','04','05']: D['n'+d]=(f'syn-n{d}.csv',f'B-2026-11-{d}.json',f'2026-11-{d}','none','')
V={'trap 0.15% both: skip':{'trapPct':0.15,'trapMode':'skip','trapSide':'BOTH'},'trap 0.25% both: skip':{'trapPct':0.25,'trapMode':'skip','trapSide':'BOTH'},
   'trap 0.2% both: HALF size':{'trapPct':0.2,'trapMode':'half','trapSide':'BOTH'},'COMBO trap 0.2 + yesterday 5%':{'trapPct':0.2,'trapMode':'skip','trapSide':'BOTH','prevMoveMax':5}}
os.makedirs('sat3',exist_ok=True)
E='/home/claude/intraday-insight/tools/live-feed/sip-engine.mjs'
def run(i,d):
    f=f'sat3/{i}-{d}.json'
    if os.path.exists(f) and os.path.getsize(f)>0: return
    t,b,day,bk,pre=D[d]; env={**os.environ,'SECT':'sectors.json','PRE':pre}
    out=subprocess.run(['node','rp.mjs',t,b,day,bk,json.dumps(list(V.values())[i]),E],capture_output=True,text=True,env=env); open(f,'w').write(out.stdout)
    if not out.stdout: open(f+'.err','w').write(out.stderr[-2000:])
jobs=[(i,d) for i in range(len(V)) for d in D]
with cf.ThreadPoolExecutor(3) as ex: list(ex.map(lambda a:run(*a),jobs))
print('done')
