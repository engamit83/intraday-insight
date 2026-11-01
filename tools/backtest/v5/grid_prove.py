import prove,itertools,json,time,multiprocessing as mp,numpy as np,collections
G=dict(mode=['break','prove'],K=[10,20],rs=[None,0.5,1.0],nochase=[False,True],vwap=[False,True],vol=[0,1.5],breadth=['45/55','55rise','none'],two=[False,True],lock=[0,0.5])
keys=list(G)
def one(vals):
    p=dict(zip(keys,vals)); P=dict(rvol=3,lockKeep=0.5,last=60 if p['mode']=='break' else 315,**p)
    tr=prove.run(P); by=collections.defaultdict(float)
    for t in tr: by[t['d']]+=t['Rs']
    if not tr: return None
    L=[t['Rs'] for t in tr if t['Rs']<0]
    return dict(p=p,n=len(tr),net=sum(by.values()),build=sum(v for d,v in by.items() if d<prove.CHECK),check=sum(v for d,v in by.items() if d>=prove.CHECK),
        lossdays=sum(v<0 for v in by.values()),worstday=min(by.values()),ourway=np.mean([t['best']>=0.5 for t in tr]),against=np.mean([t['best']<0.2 for t in tr]),
        win=np.mean([t['R']>0 for t in tr]),avgloss=np.mean(L) if L else 0,worst=min(t['Rs'] for t in tr),days=len(by))
if __name__=='__main__':
    allv=list(itertools.product(*G.values())); t0=time.time()
    print(one(allv[0]),time.time()-t0,flush=True)
    with mp.Pool() as pool: R=[r for r in pool.map(one,allv,chunksize=8) if r]
    json.dump(R,open('grid_prove.json','w'),default=str); print('variants',len(R),'time',time.time()-t0)
