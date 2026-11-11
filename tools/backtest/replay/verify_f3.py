# CHECK LOOP for f3 (independent code on raw minutes). Re-computes outcomes + key factors for random rows.
import numpy as np, sys, random
SYM=sys.argv[1]; random.seed(int(sys.argv[2])); z=np.load(f'f3-{SYM}.npz'); A=z['A']; C=list(z['cols']); col=lambda k,r: A[r,C.index(k)]
raw={}
for y in range(2022,2027):
    q=np.load(f'npz{y}/{SYM}.npz')
    for k in 'tohlcv': raw.setdefault(k,[]).append(q[k])
R={k:np.concatenate(v).astype(float) for k,v in raw.items()}; _,ix=np.unique(R['t'],return_index=True); R={k:v[ix] for k,v in R.items()}
pos={int(t):i for i,t in enumerate(R['t'])}
def px(d,m):
    for q in range(m,554,-1):
        if d*1440+q in pos: return R['c'][pos[d*1440+q]]
    for q in range(m,930):
        if d*1440+q in pos: return R['o'][pos[d*1440+q]]
days=sorted({int(t//1440) for t in R['t'] if 555<=t%1440<=929})
full=[d for d in days if sum(1 for q in range(555,930) if d*1440+q in pos)>=300]
bad=0
def check(n,k,info=''):
    global bad; print(f'  [{"OK" if k else "MISTAKE"}] {n} {info}'); bad+=not k
rs=random.sample(range(len(A)),250); e1=e2=e3=0
for r in rs:
    d,m,dr=int(col('day',r)),int(col('time',r)),int(col('dir',r)); e=px(d,m)
    # outcomes
    clean=0; trr=None; s5=False
    for q in range(m+1,916):
        if d*1440+q not in pos: continue
        h,l=R['h'][pos[d*1440+q]],R['l'][pos[d*1440+q]]
        fav=(h/e-1)*100 if dr==1 else (1-l/e)*100; adv=(1-l/e)*100 if dr==1 else (h/e-1)*100
        if adv>=0.05 and clean==0 and trr is None: clean=-1
        if fav>=2.0 and clean==0: clean=1
        if trr is None:
            if adv>=0.5: trr=-0.5
            elif fav>=2.0: trr=2.0
    clean=max(clean,0)
    if trr is None: trr=(px(d,915)/e-1)*100*dr
    e1+= clean!=col('clean',r) or abs(trr-col('tr',r))>1e-6
    # factors
    mins=[q for q in range(555,m+1) if d*1440+q in pos]; hi=max(R['h'][pos[d*1440+q]] for q in mins); lo=min(R['l'][pos[d*1440+q]] for q in mins)
    pid=(e-lo)/max(hi-lo,1e-9) if dr==1 else (hi-e)/max(hi-lo,1e-9)
    m15=dr*(e/px(d,max(m-15,555))-1)*100
    k=full.index(d); pc=px(full[k-1],929); gap=dr*(R['o'][pos[d*1440+mins[0]]]/pc-1)*100 if mins[0]==555 else None
    e2+= abs(pid-col('posInDay',r))>1e-6 or abs(m15-col('mom15',r))>1e-6 or abs(dr*(e/pc-1)*100-col('vsPrevClose',r))>1e-6 or (gap is not None and abs(gap-col('gap',r))>1e-6)
    cum=lambda dd: sum(R['v'][pos[dd*1440+q]] for q in range(555,m+1) if dd*1440+q in pos)
    base=np.median([cum(full[j]) for j in range(k-20,k)])+1
    e3+= abs(cum(d)/base-col('volDayx',r))>1e-6*max(1,col('volDayx',r))
check('outcomes clean / trade re-computed (250 random rows)', e1==0, f'({e1} differ)')
check('posInDay / mom15 / vsPrevClose / gap re-computed', e2==0, f'({e2} differ)')
check('volDayx re-computed', e3==0, f'({e3} differ)')
check('no row before 09:20 or after 14:45', A[:,C.index('time')].min()>=560 and A[:,C.index('time')].max()<=885)
print(f'ROUND RESULT {SYM}: {"CLEAN" if bad==0 else f"{bad} MISTAKE(S)"}')
