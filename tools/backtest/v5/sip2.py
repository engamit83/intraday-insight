import sip,copy
def V(**k): q=copy.deepcopy(sip.P); q.update(k); return q
for name,p in [('top10 + trail',V(K=10,trail=True)),('top10 + target2R',V(K=10,target_R=2)),('top10 rvol3 trail',V(K=10,min_rvol=3,trail=True)),
               ('top20 rvol3 trail',V(min_rvol=3,trail=True)),('top20 rvol3 target2R',V(min_rvol=3,target_R=2)),('top10 stopmin0.75 trail',V(K=10,stop_min=0.75,trail=True)),
               ('top5 trail',V(K=5,trail=True))]:
    tr=sip.run(p); sip.rep(tr,name)
