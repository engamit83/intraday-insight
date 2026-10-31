import json,subprocess,sys,os,concurrent.futures as cf
S,U,E=sys.argv[1],sys.argv[2],sys.argv[3]
B={'22':'/home/claude/v5/baseline-upto21-lc.json','23':'/home/claude/v5/baseline-upto22-lc.json','26':'/mnt/attach/outputs/lf13/sip-baseline.json','27':S+'/base27.json','28':S+'/base28.json','29':S+'/base29.json','30':S+'/base30.json'}
PRE={'26':0.50,'27':0.72,'28':0.61,'29':0.60,'30':1.48}   # market-wide pre-open buy/sell
def crowd(d): r=PRE.get(d); return None if r is None else ('SELL' if r<0.8 else 'BUY' if r>1.25 else None)
V={'now':lambda d:{},'NO re-entry':lambda d:{'reentries':0},'preopen skip + NO re-entry':lambda d:{'reentries':0,**({'skipDir':crowd(d)} if crowd(d) else {})},'no quality sizing':lambda d:{'qualitySize':False},
   'preopen: SKIP crowd side':lambda d:({'skipDir':crowd(d)} if crowd(d) else {}),
   'preopen: HALF size crowd side':lambda d:({'dirHalf':crowd(d)} if crowd(d) else {}),
   'one-sided day (>=90%) half size':lambda d:{'oneSidedHalf':0.9},
   'one-sided day (>=80%) half size':lambda d:{'oneSidedHalf':0.8},
   'P7: rvol >= 2 (with breadth)':lambda d:{'minRvol':2},
   'P7 + preopen skip crowd':lambda d:{'minRvol':2,**({'skipDir':crowd(d)} if crowd(d) else {})},
   'preopen skip + one-sided 90%':lambda d:{'oneSidedHalf':0.9,**({'skipDir':crowd(d)} if crowd(d) else {})}}
def run(name,d):
    f=f"{S}/wk/{name.replace(' ','_').replace(':','').replace('>=','ge').replace('(','').replace(')','').replace('%','')}-{d}.json"
    if not os.path.exists(f):
        out=subprocess.run(['node',S+'/rp.mjs',f'{U}/ticks-2026-10-{d}.csv',B[d],f'2026-10-{d}',f'{U}/book-2026-10-{d}.csv',json.dumps(V[name](d)),E],capture_output=True,text=True).stdout
        open(f,'w').write(out)
    return name,d,json.load(open(f))
jobs=[(n,d) for n in V for d in B]
with cf.ThreadPoolExecutor(8) as ex: res=list(ex.map(lambda a: run(*a),jobs))
R={}
for n,d,x in res: R.setdefault(n,{})[d]=x
days=list(B)
for n in V:
    row=[R[n][d]['sum']['net'] for d in days]; T=[t for d in days for t in R[n][d]['trades']]
    L=[t['net'] for t in T if t['net']<0]; W=[t['net'] for t in T if t['net']>0]
    print(f"{n:<34} "+' '.join(f"{d}:{v:>6}" for d,v in zip(days,row))+f" | total {sum(row):>6} | live-week(26-30) {sum(row[2:]):>6} | trades {len(T)} won {len(W)/max(len(T),1)*100:3.0f}% avg loss {sum(L)/max(len(L),1):>5.0f} worst {min([t['net'] for t in T] or [0])}")
