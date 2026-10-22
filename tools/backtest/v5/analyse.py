import json,numpy as np,collections
R=json.load(open('search-results.json'))
print('variants',len(R))
net=np.array([s['net'] for p,s in R]); b=np.array([s['build'] for p,s in R]); c=np.array([s['check'] for p,s in R])
print('positive overall %.0f%% | build %.0f%% | check %.0f%% | both %.0f%%'%(100*(net>0).mean(),100*(b>0).mean(),100*(c>0).mean(),100*((b>0)&(c>0)).mean()))
print('median net %.1fR, median check %.1fR'%(np.median(net),np.median(c)))
print('\nWHAT EACH CHOICE DOES (median over all other settings: net R | check-days R | worst day R):')
for k in R[0][0]:
    vals=sorted(set(str(p[k]) for p,s in R))
    if len(vals)<2: continue
    row=[]
    for v in vals:
        sel=[s for p,s in R if str(p[k])==v]
        row.append(f"{v}: {np.median([s['net'] for s in sel]):+.1f} | {np.median([s['check'] for s in sel]):+.1f} | {np.median([s['worst_day'] for s in sel]):+.1f}")
    print(f"  {k:<10}"+'   '.join(row))
cur={'OR':5,'K':10,'rvol':3,'smin':0.5,'smax':2.0,'tgt':0,'trail':1.0,'trail_from':1.0,'be':99,'last':60,'tstop':0,'gap':'any','maxrng':99,'liq':25}
for p,s in R:
    if all(p[k]==v for k,v in cur.items()): print('\nCURRENT LIVE RULES:',{k:round(v,2) if isinstance(v,float) else v for k,v in s.items()})
# walk-forward honest pick: rank by BUILD only (enough trades), look at their CHECK
ok=[(p,s) for p,s in R if s['n']>=25]
top=sorted(ok,key=lambda x:-x[1]['build'])[:15]
print('\nTOP 15 chosen on BUILD days only -> how they did on CHECK days (never seen):')
for p,s in top:
    print(f"  build {s['build']:+5.1f} check {s['check']:+5.1f} net {s['net']:+5.1f} n {s['n']} win {s['win']*100:.0f}% worstday {s['worst_day']:+.1f} lossdays {s['neg_days']}  ",{k:v for k,v in p.items() if k not in('liq','trail_from')})
rob=sorted([x for x in ok if x[1]['build']>0 and x[1]['check']>0],key=lambda x:(-min(x[1]['build']/4,x[1]['check']/3)))[:10]
print('\nMOST BALANCED (good on both halves, per-day basis):')
for p,s in rob:
    print(f"  build {s['build']:+5.1f} check {s['check']:+5.1f} net {s['net']:+5.1f} n {s['n']} win {s['win']*100:.0f}% worstday {s['worst_day']:+.1f} lossdays {s['neg_days']} avgloss {s['avg_loss']:+.2f}",s['days'],{k:v for k,v in p.items() if k not in('liq','trail_from')})
