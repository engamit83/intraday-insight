# CHECK LOOP for "the BASE entry rules" (owner 12 Nov 14:15): re-apply the written rules with independent code to today's real
# 09:20 data (engine state + baseline the engine used) and compare with what the engine actually picked/skipped/entered.
import json, statistics as st, csv, sys
D='/mnt/user-data/uploads/live-feed/data/'
S=json.load(open(D+'sip-state-2026-11-12.json')); B=json.load(open(D+'sip-baseline.json'))
OR=S['or']; OR=dict(OR) if isinstance(OR,list) else OR
mean=lambda a: sum(a)/len(a) if a else 0
import csv as _c
BH={}
for r in _c.DictReader(open(D+'nse/2026-11-11/bhavdata.csv')):
    r={k.strip():v.strip() for k,v in r.items()}
    if r.get('SERIES') in ('EQ','BE','BZ'): BH[r['SYMBOL']]=float(r['CLOSE_PRICE'])
cand=[]; gapsk=[]
for sym,o in OR.items():
    hist=(B.get('first5') or {}).get(sym,[])[-10:]; avg=mean(hist); turn=st.median((B.get('turnover') or {}).get(sym,[])) if (B.get('turnover') or {}).get(sym) else 0
    if not avg>0 or turn<25 or o.get('v0') is None or o.get('v1') is None or o['last']==o['open']: continue
    rvol=(o['v1']-o['v0'])/avg
    if rvol<3: continue
    d='BUY' if o['last']>o['open'] else 'SELL'
    pc=BH.get(sym)   # official NSE close of the previous trading day (11 Nov) = what the feed reports as previous close
    gw=((o['open']/pc-1)*100*(1 if d=='BUY' else -1)) if pc else None
    (gapsk if gw is not None and gw>1 else cand).append((sym,d,round(rvol,1),gw))
cand.sort(key=lambda c:-c[2]); mine=[(c[0],c[1]) for c in cand[:10]]
eng=[(p['sym'],p['dir']) for p in S['picks']]
print('picks same (stock+direction, same order):', mine==eng)
if mine!=eng: print('  mine',mine,'\n  engine',eng)
eg=sorted(p['sym'] for p in S.get('gapSkipped',[])); mg=sorted(g[0] for g in gapsk)
print('gap-skipped same:', eg==mg, f'({len(eg)} stocks)')
# ---- entry trigger: first price strictly beyond the 5-min high (buy) / low (sell) between 09:20 and 10:15, then the trap filter
P={p['sym']:p for p in S['picks']}; first={}; nifty=[]
for r in csv.reader(open(D+'ticks-2026-11-12.csv')):
    t,s=r[0],r[1]
    if s=='NIFTY' and '09:15:00'<=t<'09:20:01': nifty.append(float(r[2]))
    if s in P and '09:20:00'<=t<'10:15:00' and s not in first:
        p=float(r[2]); pk=P[s]
        if (pk['dir']=='BUY' and p>pk['high']) or (pk['dir']=='SELL' and p<pk['low']): first[s]=t
no=OR.get('NIFTY',{}); mkt=(no['last']/no['open']-1)*100 if no else None
print(f'market move 09:15-09:20 (Nifty open {no.get("open")} -> {no.get("last")}): {mkt:+.2f}%')
taken={r['symbol']:r['entry_time'] for r in csv.DictReader(open(D+'sip-trades-2026-11-12.csv')) if True}
firsttaken={}
for r in csv.DictReader(open(D+'sip-trades-2026-11-12.csv')):
    firsttaken.setdefault(r['symbol'],r['entry_time'])
ok=True
for s,pk in P.items():
    sg=1 if pk['dir']=='BUY' else -1; trap= mkt is not None and abs(mkt)>=0.2 and mkt*sg>0
    expect = (s in first) and not trap
    got = s in firsttaken
    same = expect==got and (not got or firsttaken[s][:5]==first[s][:5])
    ok&=same
    print(f"  {s:11} {pk['dir']:4} broke level: {first.get(s,'never')[:8]} | trap filter: {'SKIP' if trap else 'pass'} | rules say enter: {expect} | engine entered: {firsttaken.get(s,'no')} | {'OK' if same else 'DIFFERENT'}")
print('entries same as rules:',ok)
