import json,subprocess,os,concurrent.futures as cf
U='/mnt/user-data/uploads/live-feed/data/'
D={}
for d in ['22','23','26','27','28','29','30']: D[d]=(U+f'ticks-2026-10-{d}.csv',f'B-2026-10-{d}.json',f'2026-10-{d}',U+f'book-2026-10-{d}.csv',U+f'preopen-2026-10-{d}.csv')
D['06']=(U+'ticks-2026-11-06.csv','B-2026-11-06.json','2026-11-06',U+'book-2026-11-06.csv',U+'preopen-2026-11-06.csv')
for d in ['13','14','15','16','19','21']: D['o'+d]=(f'sm-2026-10-{d}.csv',f'B-2026-10-{d}.json',f'2026-10-{d}','none','')
for d in ['02','03','04','05']: D['n'+d]=(f'sm-2026-11-{d}.csv',f'B-2026-11-{d}.json',f'2026-11-{d}','none','')
DC={'trapPct':0.2,'trapMode':'skip','trapSide':'BOTH'}
V={'DC + no size changes (all 1x)':{**DC,'qualitySize':False},'DC + gap-against 1x (keep 0.5x)':{**DC,'qsBig':1.0},
   'DC + 1.5x only if volume >=10x':{**DC,'qsBigRvol':10},'DC + 1.5x only if gap-against <=2%':{**DC,'qsBigMaxGap':2},
   'DC + gap-against 1x + gap-with 1x + loss limit 500':{**DC,'qualitySize':False,'dayLossStop':500}}
os.makedirs('v1b',exist_ok=True)
E='/home/claude/intraday-insight/tools/live-feed/sip-engine.mjs'
def run(i,d):
    f=f'v1b/{i}-{d}.json'
    if os.path.exists(f) and os.path.getsize(f)>0: return
    t,b,day,bk,pre=D[d]; env={**os.environ,'SECT':'sectors.json','PRE':pre}
    out=subprocess.run(['node','rp.mjs',t,b,day,bk,json.dumps(list(V.values())[i]),E],capture_output=True,text=True,env=env); open(f,'w').write(out.stdout)
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(lambda a:run(*a),[(i,d) for i in range(len(V)) for d in D]))
print('done')
