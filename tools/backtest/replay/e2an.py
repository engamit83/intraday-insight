# ENTRY-QUALITY RESEARCH - analysis (owner brief 12 Nov 14:50). Exits are NOT changed: P&L columns are the existing exit rules' results.
# Pass mark for "add to production" (written before looking): better than the baseline in mean 30-min continuation AND expectancy
# in EVERY walk-forward test year (2024, 2025, 2026), false-breakout rate not worse, >= 30% of the baseline trades kept (fewer but better).
import json, numpy as np, collections as C
R=json.load(open('e2-rows.json'))
for r in R: r['y']=int(r['day'][:4])
def M(S):
    if not S: return None
    net=np.array([r['net'] for r in S]); d=C.defaultdict(float)
    for r in S: d[r['day']]+=r['net']
    cum=np.cumsum([d[k] for k in sorted(d)]); dd=float((cum-np.maximum.accumulate(np.r_[0,cum])[1:]).min()) if len(cum) else 0
    w=net[net>0].sum(); l=-net[net<0].sum()
    a=lambda k: float(np.mean([r[k] for r in S]))
    return dict(n=len(S),win=100*np.mean(net>0),mv30=a('mv30'),mv15=a('mv15'),mfe=a('mfe'),mae=a('mae'),exp=float(net.mean()),pf=float(w/l) if l>0 else 9.99,dd=dd,
                R=a('R'),fb=100*a('falseBO'),clean=100*a('clean15'),total=float(net.sum()))
def line(name,S,base=None):
    m=M(S)
    if not m: return f'  {name:44} (no trades)'
    keep=f"{100*m['n']/base['n']:3.0f}%" if base else ' 100%'
    return (f"  {name:44} n {m['n']:5} kept {keep} | win {m['win']:4.1f}% | 30-min {m['mv30']:+.3f}% | MFE {m['mfe']:+.2f}% MAE {m['mae']:+.2f}% | "
            f"false BO {m['fb']:4.1f}% clean1.5 {m['clean']:3.1f}% | exp Rs {m['exp']:+5.0f} PF {m['pf']:.2f} DD Rs {m['dd']:+7.0f} R {m['R']:+.3f}")
YEARS=[2022,2023,2024,2025,2026]
print('================ TASK 1: factor vs continuation (every BASE entry, replay 2022-26; old data - hint only for P&L, exact for minute-end moves)')
F=['rvol','gap','rangePct','niftyPre','sectorPre','secVsNifty','vwapDist','rsOR','niftyVsTwap','entryMin','approach','volBO']
def spear(x,y):
    ok=~(np.isnan(x)|np.isnan(y)); x,y=x[ok],y[ok]; rx=np.argsort(np.argsort(x)); ry=np.argsort(np.argsort(y)); return float(np.corrcoef(rx,ry)[0,1])
A=[r for r in R if r['y']<=2024]; B=[r for r in R if r['y']>=2025]
print('  rank-correlation with 30-min continuation (2022-24 | 2025-26) and with MFE; quintile means of 30-min move (2022-24 | 2025-26):')
for k in F:
    xa=np.array([r[k] for r in A],float); xb=np.array([r[k] for r in B],float)
    s=f'  {k:12} r30 {spear(xa,np.array([r["mv30"] for r in A])):+.3f}|{spear(xb,np.array([r["mv30"] for r in B])):+.3f}  rMFE {spear(xa,np.array([r["mfe"] for r in A])):+.3f}|{spear(xb,np.array([r["mfe"] for r in B])):+.3f} |'
    qs=np.nanquantile(xa,[0,.2,.4,.6,.8,1])
    for a,b in zip(qs[:-1],qs[1:]):
        ma=[r['mv30'] for r in A if a<=r[k]<=b]; mb=[r['mv30'] for r in B if a<=r[k]<=b]
        s+=f' [{a:.2g}..{b:.2g}] {np.mean(ma) if ma else 0:+.2f}|{np.mean(mb) if mb else 0:+.2f}'
    print(s)
# ---------------- TASK 2 + 3: filters and combinations, with walk-forward thresholds for F (breakout quality)
fixed={'A VWAP alignment':lambda r,t: r['vwapDist']>0,'B relative strength vs Nifty':lambda r,t: r['rsOR']>0,'C market trend (Nifty above/below its avg)':lambda r,t: r['niftyVsTwap']>0,
       'D sector vs Nifty':lambda r,t: r['secVsNifty']==r['secVsNifty'] and r['secVsNifty']>0,'E RVOL>5':lambda r,t: r['rvol']>5,'E RVOL>7':lambda r,t: r['rvol']>7,'E RVOL>10':lambda r,t: r['rvol']>10,
       'F1 approach momentum (top half, WF)':lambda r,t: r['approach']>=t['approach'],'F2 breakout volume (top half, WF)':lambda r,t: r['volBO']>=t['volBO']}
fx=fixed
combos={'Baseline':lambda r,t: True, **fixed,
 'A+B':lambda r,t: fx['A VWAP alignment'](r,t) and fx['B relative strength vs Nifty'](r,t),
 'B+D':lambda r,t: fx['B relative strength vs Nifty'](r,t) and fx['D sector vs Nifty'](r,t),
 'A+B+C':lambda r,t: fx['A VWAP alignment'](r,t) and fx['B relative strength vs Nifty'](r,t) and fx['C market trend (Nifty above/below its avg)'](r,t),
 'A+B+D':lambda r,t: fx['A VWAP alignment'](r,t) and fx['B relative strength vs Nifty'](r,t) and fx['D sector vs Nifty'](r,t),
 'A+B+C+D':lambda r,t: all(fx[k](r,t) for k in ['A VWAP alignment','B relative strength vs Nifty','C market trend (Nifty above/below its avg)','D sector vs Nifty']),
 'B+F2':lambda r,t: fx['B relative strength vs Nifty'](r,t) and fx['F2 breakout volume (top half, WF)'](r,t),
 'A+B+F2':lambda r,t: fx['A VWAP alignment'](r,t) and fx['B relative strength vs Nifty'](r,t) and fx['F2 breakout volume (top half, WF)'](r,t)}
def thr(train): return {'approach':float(np.median([r['approach'] for r in train])),'volBO':float(np.median([r['volBO'] for r in train]))}
print('\n================ TASK 2+3: all years together (thresholds for F from 2022-24 only)')
T=thr(A); base=M(R)
for n,f in combos.items(): print(line(n,[r for r in R if f(r,T)],base))
print('\n================ WALK-FORWARD (rolling): thresholds from all earlier years, tested on the next year; + = beats baseline that year')
score=C.defaultdict(list)
for ty in [2024,2025,2026]:
    tr=[r for r in R if r['y']<ty]; te=[r for r in R if r['y']==ty]; Tt=thr(tr); b=M(te)
    print(f'--- test year {ty} (train {min(r["y"] for r in tr)}-{ty-1})')
    for n,f in combos.items():
        S=[r for r in te if f(r,Tt)]; m=M(S); print(line(n,S,b))
        if m and n!='Baseline': score[n].append((m['mv30']>b['mv30'], m['exp']>b['exp'], m['fb']<=b['fb'], m['n']>=0.3*b['n'], m['mv30']-b['mv30'], m['exp']-b['exp']))
print('\n================ VERDICT (pass mark: better 30-min continuation AND expectancy in all 3 test years, false BO not worse, >=30% trades kept)')
for n,v in score.items():
    ok=all(a and b and c and d for a,b,c,d,_,_ in v)
    print(f"  {'ADD  ' if ok else 'reject'} {n:44} years better (cont/exp/falseBO/kept): {' '.join(''.join('+' if x else '-' for x in t[:4]) for t in v)} | d30-min {' '.join(f'{t[4]:+.3f}' for t in v)} | dExp Rs {' '.join(f'{t[5]:+.0f}' for t in v)}")
