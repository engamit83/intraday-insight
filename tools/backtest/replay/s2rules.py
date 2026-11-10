# Simple short-bias rules written BEFORE checking per year (ideas counted: 6). Hold 09:20->15:14, Rs 1 lakh per trade, cost 0.146%.
import json,numpy as np,collections as C
R=json.load(open('s2rows.json')); COST=0.146
RULES={'R1 sell every pick':lambda r:True,
 'R2 sell if 5-day rise>=3.5%':lambda r:r['ret5']>=3.5,
 'R3 sell if 5-day rise>=7.6%':lambda r:r['ret5']>=7.6,
 'R4 sell if yesterday rise>=1.9%':lambda r:r['prev1']>=1.9,
 'R5 sell if gap up>=0.95%':lambda r:r['gap']>=0.95,
 'R6 sell if near 20d high (pos20>=0.89)':lambda r:r['pos20']>=0.89,
 'R7 sell if R2 or R4 or R5':lambda r:r['ret5']>=3.5 or r['prev1']>=1.9 or r['gap']>=0.95}
Y=['2022','2023','2024','2025','2026']
for name,f in RULES.items():
    print(name)
    for y in Y+['22-24','25-26']:
        S=[r for r in R if (r['day'][:4]==y if len(y)==4 else (r['day']<'2025')==(y=='22-24')) and f(r)]
        if not S: continue
        g=np.array([-r['out'] for r in S]); net=(g-COST)*1000  # Rs per 1 lakh
        dd=C.defaultdict(float)
        for r,v in zip(S,net): dd[r['day']]+=v
        dv=np.array(list(dd.values()))
        print(f"  {y:6} n={len(S):5} right {100*(g>0).mean():4.1f}%  avg {g.mean():+.2f}% after cost {g.mean()-COST:+.2f}%  net Rs {net.sum():+9.0f}  days {len(dv)} losing {100*(dv<0).mean():.0f}%  worst {dv.min():+.0f}")
