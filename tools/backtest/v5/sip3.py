import sip,copy
def V(**k): q=copy.deepcopy(sip.P); q.update(k); return q
for name,p in [('top10 rvol1.5 trail',V(K=10,trail=True)),('top10 rvol3 trail',V(K=10,min_rvol=3,trail=True)),('top20 rvol3 trail',V(min_rvol=3,trail=True)),('top10 rvol3 target2R',V(K=10,min_rvol=3,target_R=2))]:
    tr=sip.run(p); sip.rep(tr,name)
tr=sip.run(V(K=10,min_rvol=3,trail=True))
for t in tr:
    m=t['inm']+555; print(t['day'][5:],f"{t['s']:<11}{t['D']:<5}rvol {t['rv']:5.1f} in {m//60:02d}:{m%60:02d} entry {t['entry']:.2f} stop {t['stop']:.2f} risk {t['risk']/t['entry']*100:.2f}% {t['why']:<6} {t['R']:+.2f}R gross {t['gross']:+.2f}%")
