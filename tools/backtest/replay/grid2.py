import json,subprocess,os,concurrent.futures as cf
exec(open('grid.py').read().split("V={")[0])
for d in ['13','14','15','16','19','21']: D['o'+d]=(f'syn-o{d}.csv',f'base{d}o.json',f'2026-10-{d}','none')
V={'A today (P8 on)':{},'2a half, 0.05%':{'mktDisHalf':True},'2b skip, 0.05%':{'mktDisSkip':True},'2b skip, any move':{'mktDisSkip':True,'mktMinPct':0},
   '2b skip, 0.1%':{'mktDisSkip':True,'mktMinPct':0.1},'2b skip, 0.2%':{'mktDisSkip':True,'mktMinPct':0.2},'2a half, 0.1%':{'mktDisHalf':True,'mktMinPct':0.1}}
os.makedirs('g2',exist_ok=True)
def run(n,d):
    f=f"g2/{list(V).index(n)}-{d}.json"
    if not os.path.exists(f) or os.path.getsize(f)==0:
        t,b,day,bk=D[d]; out=subprocess.run(['node','rp.mjs',t,b,day,bk,json.dumps(V[n])],capture_output=True,text=True); open(f,'w').write(out.stdout)
# reuse finished runs from grid 1
import shutil
for d in D:
    for a,b in [(0,0),(6,1),(7,2)]:
        src=f'g/{a}-{d}.json'
        if os.path.exists(src): shutil.copy(src,f'g2/{b}-{d}.json')
with cf.ThreadPoolExecutor(3) as ex: list(ex.map(lambda a:run(*a),[(n,d) for n in V for d in D]))
print('done')
