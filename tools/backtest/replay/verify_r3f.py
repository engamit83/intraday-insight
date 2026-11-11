# CHECK LOOP for r3f.npz - independent code on raw minutes
import numpy as np, sys, random, json
random.seed(int(sys.argv[1])); DR=-1 if len(sys.argv)>2 and sys.argv[2]=='buy' else 1; z=np.load('r3f.npz' if DR==1 else 'r3fb.npz'); A=z['A']; C=list(z['cols']); col=lambda k,r: A[r,C.index(k)]
R={(r['day'],r['sym']):r for r in json.load(open('s2rows.json')) if (r['ret5']>=7.6 if DR==1 else r['ret5']<=-7.6)}
iso=lambda d: str(np.datetime64('1970-01-01')+np.timedelta64(int(d),'D'))
# map sd -> symbol by replaying build order is fragile; instead identify symbol by matching rvol+ret5+day
key={}
for (day,sym),r in R.items(): key[(day,round(r['rvol'],6),round(r['ret5'],6))]=sym
cache={}
def raw(sym,y):
    if (sym,y) not in cache:
        q=np.load(f'npz{y}/{sym}.npz'); cache[(sym,y)]=({int(t):i for i,t in enumerate(q['t'])},q)
    return cache[(sym,y)]
bad=0
def check(n,k,info=''):
    global bad; print(f'  [{"OK" if k else "MISTAKE"}] {n} {info}'); bad+=not k
e1=e2=nf=0
for r in random.sample(range(len(A)),250):
    d=int(col('day',r)); m=int(col('time',r)); day=iso(d); sym=key.get((day,round(col('rvol',r),6),round(DR*col('ret5',r),6)))
    if sym is None: nf+=1; continue
    pos,q=raw(sym,day[:4])
    def px(mm):
        for k in range(mm,554,-1):
            if d*1440+k in pos: return float(q['c'][pos[d*1440+k]])
    e=px(m); clean=None; tr=None
    for k in range(m+1,916):
        if d*1440+k not in pos: continue
        h,l=float(q['h'][pos[d*1440+k]]),float(q['l'][pos[d*1440+k]]); adv=(h/e-1)*100 if DR==1 else (1-l/e)*100; fav=(1-l/e)*100 if DR==1 else (h/e-1)*100
        if clean is None:
            if adv>=0.05: clean=0
            elif fav>=2.0: clean=1
        if tr is None:
            if adv>=0.5: tr=-0.5
            elif fav>=2.0: tr=2.0
    if clean is None: clean=0
    if tr is None: tr=(1-px(915)/e)*100*DR
    e1+= clean!=col('clean',r) or abs(tr-col('tr',r))>1e-5
    mins=[k for k in range(555,m+1) if d*1440+k in pos]; hi=max(float(q['h'][pos[d*1440+k]]) for k in mins); lo=min(float(q['l'][pos[d*1440+k]]) for k in mins)
    e2+= abs(((hi-e) if DR==1 else (e-lo))/max(hi-lo,1e-9)-col('posFromHigh',r))>1e-5 or abs(-DR*(e/px(max(m-15,555))-1)*100-col('fall15',r))>1e-5 or abs(((hi/e-1) if DR==1 else (e/lo-1))*100-col('belowHigh',r))>1e-5
check('rows matched to an R3 stock-day', nf==0, f'({nf} unmatched)')
check('clean / trade outcome re-computed (250 random rows)', e1==0, f'({e1} differ)')
check('posFromHigh / fall15 / belowHigh re-computed', e2==0, f'({e2} differ)')
t=A[:,C.index('time')]; check('times 09:20-14:45 only', t.min()>=560 and t.max()<=885)
print('ROUND RESULT:', 'CLEAN' if bad==0 else f'{bad} MISTAKE(S)')
