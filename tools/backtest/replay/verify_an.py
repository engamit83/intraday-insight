# Independent re-computation of the entry-rule table (first signal per day+direction, after costs) - different code from moveAn2.py
import numpy as np, sys, collections as C
SYM=sys.argv[1]; z=np.load(f'move-{SYM}.npz'); A=z['A']; cols=list(z['cols']); c=lambda k: A[:,cols.index(k)]
yr=(np.datetime64('1970-01-01')+c('day').astype('timedelta64[D]')).astype('datetime64[Y]').astype(int)+1970
rules={'R0':np.ones(len(A),bool),'E1':c('brkDay')==1,'E2':(c('brkDay')==1)&(c('mod')<=625),'E4':(c('brkDay')==1)&(c('mod')<=625)&(c('mom15')>0.1)&(c('vwapDist')>0)&(c('rvol5')>=1.5)}
for name,m in rules.items():
    best={}
    for i in np.nonzero(m)[0]:
        k=(int(c('day')[i]),int(c('dir')[i]))
        if k not in best or c('mod')[i]<c('mod')[best[k]]: best[k]=i
    out=C.defaultdict(list)
    for (d,_),i in best.items(): out['22-24' if yr[i]<=2024 else '25-26'].append(c('trade')[i]-0.146)
    print(SYM,name,' | '.join(f"{p}: n {len(v)} win {100*np.mean(np.array(v)>0):.0f}% avg {np.mean(v):+.3f}" for p,v in sorted(out.items())))
