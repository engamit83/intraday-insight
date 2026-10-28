import json,numpy as np,sys
S=sys.argv[1]; T=[]
for d in ['22','23','26','27','28']:
    for t in json.load(open(S+f'all-{d}.json'))['trades']: t['d']=d; T.append(t)
for d in set(t['d'] for t in T):
    a=sorted([t for t in T if t['d']==d and t['rvol']>=3 and (t['gap'] is None or t['gap']<=1)],key=lambda t:-t['rvol'])
    for i,t in enumerate(a): t['rank']=i+1
ag=lambda t: t.get('breadth') is not None and ((t['dir']=='BUY' and t['breadth']<45) or (t['dir']=='SELL' and t['breadth']>55))
ok=lambda t: t['gap'] is None or t['gap']<=1
def show(lbl,a):
    if not a: print(f"{lbl:<52} n   0"); return
    R=[t['R'] for t in a]; print(f"{lbl:<52} n {len(a):>4} win {np.mean([r>0 for r in R])*100:3.0f}% avg {np.mean(R):+.2f}R total {sum(R):+6.1f}R (~Rs{int(sum(R)*1000):+,})")
print('Same entry + live exits, EVERY liquid stock that broke its 09:15-09:20 range, 1x size, 5 tick days (22,23,26,27,28 Oct)\n')
for lab,f in [('OUR PICKS: rvol>=3, top 10, gap ok',lambda t:t.get('rank',99)<=10),
              ('rvol>=3 but rank 11-20 (just outside top 10)',lambda t:10<t.get('rank',0)<=20),
              ('rvol>=3, rank >20',lambda t:t.get('rank',0)>20),
              ('rvol 2-3 (not counted as in play)',lambda t:2<=t['rvol']<3 and ok(t)),
              ('rvol 1-2',lambda t:1<=t['rvol']<2 and ok(t)),
              ('rvol <1 (quiet stocks)',lambda t:t['rvol']<1 and ok(t)),
              ('Stock X: gapped >1% our way, rvol>=3',lambda t:t['gap'] is not None and t['gap']>1 and t['rvol']>=3)]:
    a=[t for t in T if f(t)]
    show(lab,a); show('   with breadth',[t for t in a if not ag(t)]); show('   against breadth',[t for t in a if ag(t)])
