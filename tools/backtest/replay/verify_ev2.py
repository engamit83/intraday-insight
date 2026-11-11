# CHECK LOOP for the 2% event study - independent code, raw minutes (not the grid code of ev2.py).
import json, numpy as np, sys, random
SYM=sys.argv[1]; random.seed(int(sys.argv[2])); STOP=float(sys.argv[3]) if len(sys.argv)>3 else 0.4; TAG=sys.argv[4] if len(sys.argv)>4 else ''; J=json.load(open(f'ev2{TAG}-{SYM}.json')); E=J['events']; B=J['baseline']
raw={}
for y in range(2022,2027):
    q=np.load(f'npz{y}/{SYM}.npz')
    for k in 'tohlcv': raw.setdefault(k,[]).append(q[k])
R={k:np.concatenate(v).astype(np.float64) for k,v in raw.items()}; _,ix=np.unique(R['t'],return_index=True); R={k:v[ix] for k,v in R.items()}
pos={int(t):i for i,t in enumerate(R['t'])}
dn=lambda s: int((np.datetime64(s)-np.datetime64('1970-01-01')).astype(int))
def px(d,m,k='c'):
    for q in range(m,554,-1):
        if d*1440+q in pos: return R[k][pos[d*1440+q]]
def qualifies(d,m,dr):
    e=px(d,m)
    for q in range(m+1,916):
        if d*1440+q not in pos: continue
        h,l=R['h'][pos[d*1440+q]],R['l'][pos[d*1440+q]]
        adv=(1-l/e)*100 if dr==1 else (h/e-1)*100; fav=(h/e-1)*100 if dr==1 else (1-l/e)*100
        if adv>=STOP: return False
        if fav>=2.0: return True
    return False
bad=0
def check(n,ok,info=''):
    global bad; print(f'  [{"OK" if ok else "MISTAKE"}] {n} {info}'); bad+=not ok
S=random.sample(E,min(120,len(E)))
q=sum(not qualifies(dn(e['day']),int(e['time']),e['dir']) for e in S)
check('every sampled 2% move start really gives +2% before the stop (120 random moves)', q==0, f'({q} fail)')
# turning point: the minute before the start, if it also qualifies, must have a worse-or-equal entry price
tp=0
for e in S:
    d,m,dr=dn(e['day']),int(e['time']),e['dir']
    for mm in (m-1,m+1):
        if 560<=mm<=885 and qualifies(d,mm,dr) and (px(d,mm)-px(d,m))*dr< -1e-9: tp+=1
check('start = best entry price among neighbouring qualifying minutes', tp==0, f'({tp} better neighbours)')
# factors recomputed from raw minutes
fm=0
for e in S:
    d,m,dr=dn(e['day']),int(e['time']),e['dir']
    mins=[q for q in range(555,m+1) if d*1440+q in pos]
    hi=max(R['h'][pos[d*1440+q]] for q in mins); lo=min(R['l'][pos[d*1440+q]] for q in mins); c=px(d,m)
    pid=(c-lo)/max(hi-lo,1e-9) if dr==1 else (hi-c)/max(hi-lo,1e-9)
    b15=dr*(c/px(d,m-15)-1)*100 if m-15>=555 else dr*(c/px(d,555)-1)*100
    fm+= abs(pid-e['posInDay'])>1e-6 or abs(b15-e['before15'])>1e-6
check('posInDay and before15 re-computed from raw minutes (120 moves)', fm==0, f'({fm} differ)')
# baseline moments must not be 2%-move starts... (they may still qualify inside other runs only if not marked) - check they are outside events
evkeys={(e['day'],int(e['time'])) for e in E}
check('no baseline moment is an event start', not any((b['day'],int(b['time'])) in evkeys for b in B))
# no double counting: two moves in the same direction on the same day must have a >=1% pullback between (after the first reached +2%)
from collections import defaultdict
G=defaultdict(list)
for e in E: G[(e['day'],e['dir'])].append(e)
dbl=0; tot=0
for (day,dr),L in random.sample(sorted(G.items()),min(150,len(G))):
    L=sorted(L,key=lambda e:e['time']); d=dn(day)
    for a,b in zip(L,L[1:]):
        tot+=1; t2=int(a['time']+a['mins_to_2pct']); ps=[px(d,m) for m in range(int(a['time']),int(b['time'])+1)]
        best=ps[0]; mx=0
        for k,p in enumerate(ps):
            best=max(best,p) if dr==1 else min(best,p)
            if int(a['time'])+k>=t2: mx=max(mx,((best-p)/best*100) if dr==1 else ((p-best)/best*100))
        dbl+= (int(b['time'])<=t2) or mx<1.0-1e-9
check('same-direction moves on one day are really separate (>=1% pullback between)', dbl==0, f'({dbl} of {tot} pairs)')
print(f'ROUND RESULT {SYM}: {"CLEAN" if bad==0 else f"{bad} MISTAKE(S)"}')
