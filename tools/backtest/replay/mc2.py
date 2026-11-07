import json,subprocess,os,concurrent.futures as cf,sys
P=json.load(open('mcpicks.json')); E='/home/claude/intraday-insight/tools/live-feed/sip-engine.mjs'; seeds=range(int(sys.argv[1]),int(sys.argv[2]))
def run(day,seed):
    f=f'mc2/{day}-{seed}.json'
    if os.path.exists(f) and os.path.getsize(f)>0: return
    csv=f'mc2/{day}-{seed}.csv'
    subprocess.run(['python3','synth_mc2.py',day,str(seed),csv,json.dumps(P[day])],check=True)
    out=subprocess.run(['node','rp.mjs',csv,f'B-{day}.json',day,'none','{}',E],capture_output=True,text=True,env={**os.environ,'SECT':'sectors.json'})
    open(f,'w').write(out.stdout); os.remove(csv)
with cf.ThreadPoolExecutor(2) as ex: list(ex.map(lambda a:run(*a),[(d,s) for s in seeds for d in P]))
print('done')
