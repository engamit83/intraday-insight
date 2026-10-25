exec(open('late.py').read().split('grid=dict')[0])
import itertools
res=[]
for st,X,mv,dr,K in itertools.product([135,150,165,180,195],[4,5,7],[0.2,0.3,0.5],['any','vwap'],[3,5]):
    p=dict(X=X,mv=mv,dir=dr,entry='break',end=min(st+120,300),K=K,start=st,wait=15); s=search.score(run(p)); res.append((p,s))
pf=[s['net']>0 for p,s in res]; both=[s['build']>0 and s['check']>0 for p,s in res]
print('variants',len(res),'profitable',sum(pf),'positive in BOTH halves',sum(both),'median net %+.1fR'%np.median([s['net'] for p,s in res]))
for k,vs in [('start',[135,150,165,180,195]),('X',[4,5,7]),('mv',[0.2,0.3,0.5]),('dir',['any','vwap']),('K',[3,5])]:
    print(k,{v:round(float(np.median([s['net'] for p,s in res if p[k]==v])),1) for v in vs})
for p,s in sorted(res,key=lambda r:-min(r[1]['build'],r[1]['check']))[:5]:
    print({k:p[k] for k in ['start','X','mv','dir','K']}, f"n {s['n']} win {s['win']*100:.0f}% net {s['net']:+.1f}R build {s['build']:+.1f} check {s['check']:+.1f} worst {s['worst_day']:+.1f} lossdays {int(s['neg_days'])} avgloss {s['avg_loss']:.2f}", s['days'])
