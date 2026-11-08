import json,glob,collections,datetime as dt
DT=json.load(open('daytypes.json')); T=[]
for f in glob.glob('days/*-P.json'):
    j=json.load(open(f)); d=DT.get(j['day'],{})
    for t in j['trades'] or []:
        sec=(t['inTs']//1000+19800)%86400; t.update(day=j['day'],min=(sec-33300)//60,ngap=d.get('gap',0),vix=d.get('vix') or 0); T.append(t)
def rep(name,key):
    g=collections.defaultdict(list)
    for t in T: g[key(t)].append(t['net'])
    print('--',name)
    for k in sorted(g,key=str): v=g[k]; print(f'  {str(k):18} n={len(v):4} net={sum(v):8.0f} avg={sum(v)/len(v):6.0f} win={sum(x>0 for x in v)/len(v)*100:3.0f}%')
sg=lambda t:1 if t['dir']=='BUY' else -1
rep('dir',lambda t:t['dir'])
rep('entry minute after 09:15',lambda t:min(t['min']//10*10,60))
rep('rvol',lambda t:'3-5' if t['rvol']<5 else '5-10' if t['rvol']<10 else '10+')
rep('stock gap with dir',lambda t:round(min(max((t['gap'] or 0)*sg(t),-3),3)))
rep('risk%',lambda t:t['riskPct'])
rep('breadth with dir',lambda t:int(((t['breadth']-50)*sg(t))//5*5))
rep('nifty gap with dir',lambda t:round(min(max(t['ngap']*sg(t),-1),1),1)//0.25*0.25)
rep('vix',lambda t:int(t['vix']//2*2))
rep('re-entry',lambda t:t['re'])
rep('mult',lambda t:t['mult'])
