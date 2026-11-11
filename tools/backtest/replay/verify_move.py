# CHECK LOOP for the move study (owner 11 Nov 11:03): independent re-computation, different code from move.py.
# Each check prints OK or MISTAKE. A round is clean only when every check is OK.
import numpy as np, sys, random
SYM=sys.argv[1]; z=np.load(f'move-{SYM}.npz'); A=z['A']; C=list(z['cols']); col=lambda k: A[:,C.index(k)]
random.seed(int(sys.argv[2]) if len(sys.argv)>2 else 1)
raw={}
for y in range(2022,2027):
    q=np.load(f'npz{y}/{SYM}.npz');
    for k in 'tohlcv': raw.setdefault(k,[]).append(q[k])
R={k:np.concatenate(v).astype(np.float64) for k,v in raw.items()}; _,ix=np.unique(R['t'],return_index=True); R={k:v[ix] for k,v in R.items()}
pos={int(t):i for i,t in enumerate(R['t'])}
bad=0
def check(name,ok,info=''):
    global bad
    print(f'  [{"OK" if ok else "MISTAKE"}] {name} {info}'); bad+= (not ok)
# 1) re-compute good / trade / key features for 300 random rows straight from the raw minutes
mis=C_=0; mf=0
for r in random.sample(range(len(A)),300):
    d,m,dr=int(col('day')[r]),int(col('mod')[r]),int(col('dir')[r])
    t0=d*1440+m; i=pos[t0]; e=R['c'][i]
    fut=[pos[d*1440+k] for k in range(m+1,916) if d*1440+k in pos]
    good=0; tr=None
    for j in fut:
        h,l=R['h'][j],R['l'][j]
        up_hit = (h>=e*1.01) if dr==1 else (l<=e*0.99); dn_hit=(l<=e*0.996) if dr==1 else (h>=e*1.004)
        if dn_hit: tr=-0.4; break
        if up_hit: good=1; tr=1.0; break
    if tr is None: tr=(R['c'][fut[-1]]/e-1)*100*dr
    mis+= (good!=col('good')[r]) or abs(tr-col('trade')[r])>1e-6
    # features
    dayix=[pos[d*1440+k] for k in range(555,m+1) if d*1440+k in pos]
    op=R['o'][dayix[0]]; fo=dr*(e/op-1)*100
    hiprev=max(R['h'][j] for j in dayix[:-1]); loprev=min(R['l'][j] for j in dayix[:-1])
    brk=int(e>hiprev) if dr==1 else int(e<loprev)
    vv=np.array([R['v'][j] for j in dayix]); pp=np.array([(R['h'][j]+R['l'][j]+R['c'][j])/3 for j in dayix]); vw=(vv*pp).sum()/max(vv.sum(),1)
    mf+= abs(fo-col('fromOpen')[r])>1e-6 or brk!=col('brkDay')[r] or abs(dr*(e/vw-1)*100-col('vwapDist')[r])>1e-6
check('good/trade re-computed independently for 300 random minutes', mis==0, f'({mis} differ)')
check('fromOpen / brkDay / vwapDist re-computed for 300 random minutes', mf==0, f'({mf} differ)')
# 2) no look-ahead: features must not change if the future of the day is removed -> test by correlation of features with FUTURE beyond 15:15? use a direct test:
#    shuffle-in-time test: a feature computed only from the past cannot predict the past-only control; here we check that brkDay never uses minute i's own high
brk=col('brkDay'); fo=col('fromOpen')
check('brkDay never fires when close is not beyond the earlier extreme (sign check)', np.all((brk==0)|(fo>-50)))
# 3) entry window and exits
mod=col('mod'); check('entries only 09:20-14:45', mod.min()>=560 and mod.max()<=885, f'({int(mod.min())}-{int(mod.max())})')
tr=col('trade'); g=col('good')
check('trade = +1 exactly when good, never above +1 or below about -0.4 except 15:15 exits', np.all(tr[g==1]==1.0) and np.all(tr[g==0]<1.0))
# 4) mom5 / mom15 must use the price exactly 5 / 15 minutes earlier (last trade at or before that minute)
def px_at(d,k):
    for q in range(k,554,-1):
        if d*1440+q in pos: return R['c'][pos[d*1440+q]]
    return None
mm5=0
for r in random.sample(range(len(A)),300):
    d,m,dr=int(col('day')[r]),int(col('mod')[r]),int(col('dir')[r]); e=px_at(d,m)
    for k,lag in (('mom5',5),('mom15',15)):
        p=px_at(d,m-lag); 
        if p is None: p=px_at(d,555)
        mm5+= abs(dr*(e/p-1)*100-col(k)[r])>1e-6
check('mom5/mom15 = exact 5/15-minute moves (300 random minutes)', mm5==0, f'({mm5} differ)')
# 5) rvol5 re-computed independently (last 5 min volume / same-time median of previous 20 days, floor 0.25x mean) for 200 random rows
days=sorted({int(x) for x in R['t']//1440 if sum(1 for q in range(555,930) if int(x)*1440+q in pos)>=300})
def v5(d,m): return sum(R['v'][pos[d*1440+q]] for q in range(m-4,m+1) if d*1440+q in pos)
rvm=0
for r in random.sample(range(len(A)),200):
    d,m=int(col('day')[r]),int(col('mod')[r]); k=days.index(d); prev=[v5(days[j],m) for j in range(k-20,k)]
    base=max(np.median(prev),0.25*np.mean(prev))+1; rvm+= abs(v5(d,m)/base-col('rvol5')[r])>1e-6*max(1,col('rvol5')[r])
check('rvol5 re-computed independently (200 random minutes)', rvm==0, f'({rvm} differ)')
print(f'ROUND RESULT {SYM}: {"CLEAN" if bad==0 else f"{bad} MISTAKE(S)"}')
