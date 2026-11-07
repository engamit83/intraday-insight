import json,subprocess,os,concurrent.futures as cf
P=json.load(open('mcpicks.json')); E='/home/claude/intraday-insight/tools/live-feed/sip-engine.mjs'
def run(day,seed):
    f=f'mc/{day}-{seed}.json'
    if os.path.exists(f) and os.path.getsize(f)>0: return
    csv=f'mc/{day}-{seed}.csv'
    subprocess.run(['python3','synth_mc.py',day,str(seed),csv,json.dumps(P[day])],check=True)
    out=subprocess.run(['node','rp.mjs',csv,f'B-{day}.json',day,'none','{}',E],capture_output=True,text=True,env={**os.environ,'SECT':'sectors.json'})
    open(f,'w').write(out.stdout); os.remove(csv)
jobs=[(d,s) for s in range(60) for d in P]
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(lambda a:run(*a),jobs))
print('done')
