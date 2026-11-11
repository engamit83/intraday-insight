# RULE FINDER per stock (owner 11 Nov 16:36). Uses f3-SYM.npz. Build on 2022-24 ONLY, check on 2025-26.
# Trade per rule: FIRST signal of the day (either direction) -> target +2%, stop 0.5%, else 15:15; costs 0.146%.
# PASS MARK (written first): avg after costs > 0 in BOTH 2022-24 and 2025-26, >= 60 trades in each, and positive in >= 4 of 5 years.
# Search: beam search over 1-3 conditions (thresholds at 2022-24 quintiles); every condition tried is counted (luck bar).
import numpy as np, sys, json
SYM=sys.argv[1]; FILE=sys.argv[2] if len(sys.argv)>2 else f'f3-{SYM}.npz'; z=np.load(FILE); A=z['A']; C=list(z['cols']); COST=0.146
o=np.lexsort((A[:,1],A[:,0])); A=A[o]; col=lambda k: A[:,C.index(k)]
day=col('day').astype(int); yr=(np.datetime64('1970-01-01')+day.astype('timedelta64[D]')).astype('datetime64[Y]').astype(int)+1970
P1=yr<=2024; P2=yr>=2025; clean=col('clean'); tr=col('tr')-COST
F=[c for c in C if c not in ('day','dir','clean','tr','clean15')]
c15=col('clean15') if 'clean15' in C else clean
RANK=sys.argv[3] if len(sys.argv)>3 else 'trade'   # 'clean15' = rank rules by the share of entries that give a clean 1.5% move
print(f'################ {SYM} - rule finder (old data - hint only) ################')
print(f'rows {len(A)}; clean-2% minutes: 22-24 {100*clean[P1].mean():.1f}%  25-26 {100*clean[P2].mean():.1f}% | clean-1.5%: {100*c15[P1].mean():.1f}% / {100*c15[P2].mean():.1f}%')
# 1) MUST-HAVES: share of clean-2% minutes having the condition (>=90% = must-have)
conds=[]
for f in F:
    x=col(f); ok=~np.isnan(x)
    u=np.unique(x[ok&P1])
    if len(u)<=2:
        for val in u: conds.append((f'{f}=={val:g}',(x==val)))
        continue
    for q in (0.2,0.4,0.6,0.8):
        t=np.nanquantile(x[P1],q); conds.append((f'{f}>={t:.3g}',ok&(x>=t))); conds.append((f'{f}<={t:.3g}',ok&(x<=t)))
conds.append(('dir==1 (buy)',col('dir')==1)); conds.append(('dir==-1 (sell)',col('dir')==-1))
print(f'\n1) MUST-HAVES (present in >=90% of clean-2% minutes, both periods) and ALONE lift (clean-rate with condition / base), {len(conds)} conditions tried')
base1,base2=clean[P1].mean(),clean[P2].mean(); singles=[]
for n,m in conds:
    s1=m[P1&(clean==1)].mean(); s2=m[P2&(clean==1)].mean()
    r1=clean[P1&m].mean() if (P1&m).sum()>500 else np.nan; r2=clean[P2&m].mean() if (P2&m).sum()>500 else np.nan
    singles.append((n,s1,s2,r1/base1,r2/base2))
mh=[s for s in singles if s[1]>=0.9 and s[2]>=0.9 and not s[0].startswith(('time>=','time<=')) and (s[3]>1.05 and s[4]>1.05)]
print('   must-haves:', '; '.join(f'{n} ({100*a:.0f}%/{100*b:.0f}% of moves, lift x{c:.2f}/x{d:.2f})' for n,a,b,c,d in mh) or 'none (no single condition is in 90% of moves AND helps)')
st=sorted([s for s in singles if s[3]==s[3] and s[4]==s[4] and min(s[3],s[4])>=1.3],key=lambda s:-min(s[3],s[4]))
print('   strongest ALONE (lift in both periods):')
for n,a,b,c,d in st[:25]: print(f'      {n:28} lift x{c:.2f} | x{d:.2f}   (in {100*a:.0f}% | {100*b:.0f}% of clean moves)')
# 2) RULES: beam search on 2022-24 by first-signal trade result
def first(m):
    ix=np.nonzero(m)[0]
    if len(ix)==0: return ix
    _,f=np.unique(day[ix],return_index=True); return ix[f]
def score(m,P):
    f=first(m&P); r=tr[f]; return (r.mean() if len(r) else -9), len(r), r
beam=[((),np.ones(len(A),bool))]; tried=0; allres=[]
for depth in range(3):
    cand=[]
    for names,m in beam:
        for n,c in conds:
            if n in names: continue
            mm=m&c; tried+=1
            s,nt,_=score(mm,P1)
            if nt>=100:
                if RANK=='clean15': s=c15[first(mm&P1)].mean()
                cand.append((s,names+(n,)))   # memory fix: keep names only, rebuild mask later
    cand.sort(key=lambda t:-t[0]); seen=set(); beam=[]
    CD=dict(conds)
    for s,names in cand:
        mm=np.ones(len(A),bool)
        for q in names: mm&=CD[q]
        k=tuple(sorted(names))
        if k in seen: continue
        seen.add(k); beam.append((names,mm)); allres.append((s,names))
        if len(beam)>=25: break
print(f'\n2) RULES (beam search, {tried} rule variants tried -> strict bar). Top 12 by 2022-24, then checked on 2025-26 (never seen):')
allres.sort(key=lambda t:-t[0]); out=[]; CD=dict(conds)
for s,names in allres[:12]:
    mm=np.ones(len(A),bool)
    for q in names: mm&=CD[q]
    a,na,_=score(mm,P1); b,nb,_=score(mm,P2)
    ys=[score(mm,yr==y)[0]*score(mm,yr==y)[1] for y in range(2022,2027)]
    ok=na>=60 and nb>=60 and a>0 and b>0 and sum(x>0 for x in ys)>=4
    out.append(dict(rule=' AND '.join(names),build=[round(a,3),na],check=[round(b,3),nb],years=[round(x,1) for x in ys],passed=bool(ok)))
    f1=first(mm&P1); f2=first(mm&P2)
    print(f'   {"PASS" if ok else "  - "} {" AND ".join(names)}\n        2022-24: {na} trades avg {a:+.3f}% clean1.5% {100*c15[f1].mean():.0f}% clean2% {100*clean[f1].mean():.0f}% | 2025-26: {nb} trades avg {b:+.3f}% clean1.5% {100*c15[f2].mean():.0f}% clean2% {100*clean[f2].mean():.0f}% | per year total %: {" ".join(f"{x:+.0f}" for x in ys)}')
json.dump(out,open(FILE.replace('.npz','-rules.json'),'w'))
