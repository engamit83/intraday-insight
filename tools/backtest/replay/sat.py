import json,subprocess,os,concurrent.futures as cf
U='/mnt/user-data/uploads/live-feed/data/'
D={}
for d in ['22','23','26','27','28','29','30']: D[d]=(U+f'ticks-2026-10-{d}.csv',f'B-2026-10-{d}.json',f'2026-10-{d}',U+f'book-2026-10-{d}.csv',U+f'preopen-2026-10-{d}.csv')
D['06']=(U+'ticks-2026-11-06.csv','B-2026-11-06.json','2026-11-06',U+'book-2026-11-06.csv',U+'preopen-2026-11-06.csv')
for d in ['13','14','15','16','19','21']: D['o'+d]=(f'syn-o{d}.csv',f'B-2026-10-{d}.json',f'2026-10-{d}','none','')
for d in ['02','03','04','05']: D['n'+d]=(f'syn-n{d}.csv',f'B-2026-11-{d}.json',f'2026-11-{d}','none','')
V={'A current rules':{},'P8 soft (+0.1R)':{'protectFrac':0,'protectKeepR':0.1},'no P8':{'protectAt':None},
   'yesterday moved >=8% our way: skip':{'prevMoveMax':8},'yesterday moved >=5% our way: skip':{'prevMoveMax':5},
   'sell trap 0.3%: skip sells':{'trapPct':0.3,'trapMode':'skip','trapSide':'SELL'},'sell trap 0.3%: half sells':{'trapPct':0.3,'trapMode':'half','trapSide':'SELL'},
   'trap 0.3% both sides: skip':{'trapPct':0.3,'trapMode':'skip','trapSide':'BOTH'},'sector stronger/weaker than market':{'sectorRel':True},
   'buys need volume >=5x':{'buyMinRvol':5},'buys need volume >=8x':{'buyMinRvol':8},'Rule 2: one-sided >=90% half size':{'oneSidedHalf':0.9}}
os.makedirs('sat',exist_ok=True)
E='/home/claude/intraday-insight/tools/live-feed/sip-engine.mjs'
def run(i,d):
    f=f'sat/{i}-{d}.json'
    if os.path.exists(f) and os.path.getsize(f)>0: return
    t,b,day,bk,pre=D[d]; env={**os.environ,'SECT':'sectors.json','PRE':pre}
    out=subprocess.run(['node','rp.mjs',t,b,day,bk,json.dumps(list(V.values())[i]),E],capture_output=True,text=True,env=env); open(f,'w').write(out.stdout)
    if not out.stdout: open(f+'.err','w').write(out.stderr[-2000:])
jobs=[(i,d) for i in range(len(V)) for d in D]
with cf.ThreadPoolExecutor(3) as ex: list(ex.map(lambda a:run(*a),jobs))
print('done')
