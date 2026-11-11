# Analysis of ev2-SYM.json: every 2% move, when, what was present. Stable = same picture in 2022-24 and 2025-26.
import json, numpy as np, sys, collections as C
SYM=sys.argv[1]; J=json.load(open(f'ev2-{SYM}.json')); E=J['events']; B=J['baseline']
P=lambda r: '22-24' if r['day']<'2025' else '25-26'
print(f'################ {SYM}: 2% MOVES (+2% before -0.4% against), 2022-26 - old data, hint only ################')
print('\n1) HOW MANY')
for y in ['2022','2023','2024','2025','2026']:
    e=[x for x in E if x['day'][:4]==y]; dd=C.Counter(x['day'] for x in e); nd=len({b['day'] for b in B if b['day'][:4]==y})
    print(f'   {y}: {len(e)} moves on {len(dd)} of {nd} days | up {sum(x["dir"]==1 for x in e)} down {sum(x["dir"]==-1 for x in e)} | days with 1 move {sum(v==1 for v in dd.values())}, 2 moves {sum(v==2 for v in dd.values())}, 3+ {sum(v>=3 for v in dd.values())}')
sz=np.array([x['size'] for x in E]); tt=np.array([x['mins_to_2pct'] for x in E])
print(f'   size of the full move: median {np.median(sz):.1f}%, 25% of moves >= {np.percentile(sz,75):.1f}% | time from start to +2%: median {np.median(tt):.0f} min (25%: {np.percentile(tt,25):.0f}, 75%: {np.percentile(tt,75):.0f})')
print('\n2) WHEN THEY START (share of moves by start time)')
for p in ['22-24','25-26']:
    t=np.array([x['time'] for x in E if P(x)==p])
    print(f'   {p}: '+'  '.join(f'{a//60:02d}:{a%60:02d}-{b//60:02d}:{b%60:02d} {100*np.mean((t>=a)&(t<b)):.0f}%' for a,b in [(560,575),(575,600),(600,630),(630,690),(690,780),(780,886)]))
print('\n3) WHAT WAS THERE AT THE START: share of 2% moves with the factor vs share of ordinary moments (lift = moves / ordinary)')
F=[('starts at the day extreme against it (bottom for an up move, top for a down move)',lambda r:r['posInDay']<=0.15),
   ('price was going the OTHER way in the 15 min before (a turn)',lambda r:r['before15']<-0.2),
   ('price was already going OUR way in the 15 min before (continuation)',lambda r:r['before15']>0.2),
   ('breaks the day high/low our way at that minute',lambda r:r['brkDay']==1),
   ('beyond yesterday high (up) / low (down)',lambda r:r['brkPrev']==1),
   ('at yesterday low (up) / high (down) (within 0.3%) - a support/resistance turn',lambda r:r['nearPrevLevel']==1),
   ('volume of last 15 min > 2x normal for that time',lambda r:r['vol15x']>=2),
   ('day volume so far > 1.5x normal',lambda r:r['volDayx']>=1.5),
   ('day range so far already > its 20-day average range',lambda r:r['rangeVs20']>=1),
   ('within the first 30 min (09:20-09:45)',lambda r:r['time']<=585),
   ('gap our way > 0.5%',lambda r:r['gap']>0.5),('gap against > 0.5%',lambda r:r['gap']<-0.5),
   ('Nifty last 15 min our way (>0.1%)',lambda r:r['nifty15']>0.1),('Nifty last 15 min against (>0.1%)',lambda r:r['nifty15']<-0.1),
   ('sector last 15 min our way (>0.1%)',lambda r:r['sector15']>0.1),
   ('yesterday moved our way > 1%',lambda r:r['prev1']>1),('yesterday moved against > 1%',lambda r:r['prev1']<-1),
   ('5-day trend our way > 3%',lambda r:r['ret5']>3),('5-day trend against > 3%',lambda r:r['ret5']<-3),
   ('stock is volatile lately (20-day avg range in top third)',None),
   ('VIX >= 16',lambda r:(r['vix'] or 0)>=16),('news/filing that day',lambda r:r['news']==1),('results/board day',lambda r:r['results']==1),
   ('US market last night our way > 0.5%',lambda r:(r['spx'] or 0)>0.5),
   ('DURING the move: Nifty moved our way > 0.3% (explains, not known at entry)',lambda r:r['niftyDuring']>0.3),
   ('DURING the move: sector moved our way > 0.3% (explains, not known at entry)',lambda r:r['sectorDuring']>0.3)]
r20=np.array([b['rng20'] for b in B if P(b)=='22-24']); thr=np.percentile(r20,66.7)
print(f"   {'factor':86} {'22-24: moves vs ordinary  lift':32} {'25-26: moves vs ordinary  lift':32}")
for name,f in F:
    if f is None: f=lambda r,t=thr: r['rng20']>=t
    s=f'   {name:86}'; L=[]
    for p in ['22-24','25-26']:
        e=[x for x in E if P(x)==p]; b=[x for x in B if P(x)==p]
        a=100*np.mean([bool(f(x)) for x in e]); o=100*np.mean([bool(f(x)) for x in b]); lift=a/max(o,0.1); L.append(lift)
        s+=f' {a:5.0f}% vs {o:4.0f}%  x{lift:4.1f}          '
    tag='  <== STRONG, both periods' if min(L)>=2 else ('  <- helps, both periods' if min(L)>=1.3 else ('  (rare in moves)' if max(L)<=0.7 else ''))
    print(s+tag)
print('\n4) TYPES OF 2% MOVES (share of all moves)')
types=C.Counter()
for x in E:
    if x['time']<=575: t='opening drive (starts 09:20-09:35)'
    elif x['posInDay']<=0.15 and x['before15']<0: t='TURN at the day extreme (reversal)'
    elif x['brkDay']==1 or (x['posInDay']>=0.85 and x['before15']>0): t='BREAKOUT / continuation of the day trend'
    else: t='middle of the range (other)'
    types[(P(x),t)]+=1
for t in sorted({k[1] for k in types}):
    print(f'   {t:45} 22-24 {100*types[("22-24",t)]/max(1,sum(v for k,v in types.items() if k[0]=="22-24")):.0f}%   25-26 {100*types[("25-26",t)]/max(1,sum(v for k,v in types.items() if k[0]=="25-26")):.0f}%')
