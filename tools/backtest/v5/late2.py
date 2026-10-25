import sys; sys.argv=['x']
exec(open('late.py').read().split('grid=dict')[0])
import itertools
res=[]
for st,X,dr,K in itertools.product([105,165],[5,7,10],['any','vwap','fade'],[3,5]):
    p=dict(X=X,mv=0.3,dir=dr,entry='break',end=st+120,K=K,start=st,wait=15); s=search.score(run(p)); res.append((p,s))
print('profitable',sum(s['net']>0 for p,s in res),'of',len(res))
for p,s in sorted(res,key=lambda r:-r[1]['net'])[:6]:
    print({k:p[k] for k in ['start','X','dir','K']}, f"n {s['n']} win {s['win']*100:.0f}% net {s['net']:+.1f}R build {s['build']:+.1f} check {s['check']:+.1f} lossdays {int(s['neg_days'])}")
