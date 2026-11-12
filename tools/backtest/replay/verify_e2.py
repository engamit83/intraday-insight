# CHECK LOOP for e2-rows (independent code on raw minutes). Tolerance 1e-4 % (prices are stored as float32).
import json,random,numpy as np,sys
random.seed(int(sys.argv[1])); R=json.load(open('e2-rows.json')); TOL=1e-4
def raw(sym,day):
    z=np.load(f'npz{day[:4]}/{sym}.npz'); d=int((np.datetime64(day)-np.datetime64('1970-01-01')).astype(int)); m=(z['t']//1440==d)
    return {int(t%1440):tuple(float(x) for x in (o,h,l,c,v)) for t,o,h,l,c,v in zip(z['t'][m],z['o'][m],z['h'][m],z['l'][m],z['c'][m],z['v'][m])}
def px(M,k):
    for q in range(k,554,-1):
        if q in M: return M[q][3]
errs={'or-range':0,'level/mv30':0,'vwap':0,'rs':0,'mfe':0,'mae':0,'falseBO':0}
for r in random.sample(R,150):
    M=raw(r['sym'],r['day']); N=raw('NIFTY',r['day']); sg=1 if r['dir']=='BUY' else -1
    orh=max(M[q][1] for q in range(555,560) if q in M); orl=min(M[q][2] for q in range(555,560) if q in M); lvl=orh if sg==1 else orl
    m=555+r['entryMin']+5
    errs['or-range']+= abs((orh-orl)/orl*100-r['rangePct'])>TOL
    errs['level/mv30']+= abs(sg*(px(M,min(m+30,915))/lvl-1)*100-r['mv30'])>TOL
    p=m-1; ks=[q for q in range(555,p+1) if q in M]; vv=sum(M[q][4] for q in ks); vw=sum(M[q][4]*(M[q][1]+M[q][2]+M[q][3])/3 for q in ks)/vv if vv>0 else px(M,p)
    errs['vwap']+= abs(sg*(lvl/vw-1)*100-r['vwapDist'])>TOL
    so=(px(M,559)/M[min(ks)][0]-1)*100; no=(px(N,559)/N[min(q for q in N if q>=555)][0]-1)*100
    errs['rs']+= abs(sg*(so-no)-r['rsOR'])>TOL
    fut=[q for q in range(m+1,916) if q in M]; c0=sg*(px(M,m)/lvl-1)*100
    best=max([sg*((M[q][1] if sg==1 else M[q][2])/lvl-1)*100 for q in fut]+[c0]); worst=min([sg*((M[q][2] if sg==1 else M[q][1])/lvl-1)*100 for q in fut]+[c0])
    errs['mfe']+= abs(best-r['mfe'])>TOL; errs['mae']+= abs(worst-r['mae'])>TOL
    back=[sg*(px(M,q)-lvl)/max(orh-orl,1e-9) for q in range(m+1,min(m+11,916))]
    errs['falseBO']+= int(min(back)<-0.3)!=r['falseBO']
bad=0
for k,v in errs.items(): print(f"  [{'OK' if v==0 else 'MISTAKE'}] {k} re-computed for 150 random entries ({v} differ)"); bad+=v>0
print('ROUND RESULT:', 'CLEAN' if bad==0 else f'{bad} MISTAKE(S)')
