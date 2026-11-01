# early.py - owner 1 Nov "do it": spot WRONG entries in the first seconds after entry (real ticks + order book), exit near zero.
# All liquid stocks' breakout trades on 7 tick days (all-DD.json replays, today's entry+exit rules) + our picks marked.
# For every trade: price path, best R, back-inside-range, volume, buyer/seller book in the first 30..180 s.
# Rule test: "exit at checkpoint c if <condition>" -> R at that moment (with slippage+cost) replaces the trade's final R.
import json,collections,numpy as np,pandas as pd,datetime as dt,sys,itertools
S='/tmp/claude-0/-home-claude/fbde424c-78e6-522a-98d8-a98461b8903b/scratchpad/'; U='/mnt/user-data/uploads/live-feed/data/'
COST,SLIP=0.10628,0.02; CK=[20,30,45,60,90,120,180]
P=json.load(open(S+'prove/trades.json'))["A today's rules"]
def sec(s): return int(s[:2])*3600+int(s[3:5])*60+float(s[6:])
rows=[]
for d in ['22','23','26','27','28','29','30']:
    T=[t for t in json.load(open(S+f'all/all-{d}.json'))['trades'] if not (t['gap'] is not None and t['gap']>1)]
    picked={(t['sym'],t['inTs']) for t in P[d]}; psym={t['sym'] for t in P[d]}
    need={t['sym'] for t in T}
    tk=pd.read_csv(U+f'ticks-2026-10-{d}.csv',usecols=['time','symbol','price','day_volume'])
    tk=tk[tk.symbol.isin(need)]; tk['s']=tk.time.map(sec)
    bk=pd.read_csv(U+f'book-2026-10-{d}.csv',usecols=['time','symbol','total_buy_qty','total_sell_qty'])
    bk=bk[bk.symbol.isin(need)]; bk['s']=bk.time.map(sec); bk=bk[(bk.total_buy_qty>0)&(bk.total_sell_qty>0)]; bk['ratio']=bk.total_buy_qty/bk.total_sell_qty
    TK={s:g.sort_values('s') for s,g in tk.groupby('symbol')}; BK={s:g.sort_values('s') for s,g in bk.groupby('symbol')}
    for t in T:
        g=TK.get(t['sym']);
        if g is None: continue
        sg=1 if t['dir']=='BUY' else -1; s0=(t['inTs']/1000+19800)%86400
        orw=g[(g.s>=33300)&(g.s<33600)]
        if orw.empty: continue
        hi,lo=orw.price.max(),orw.price.min(); lvl=hi if sg>0 else lo; opp=lo if sg>0 else hi
        aft=g[(g.s>=s0)&(g.s<=s0+max(CK))]
        if aft.empty: continue
        e=aft.price.iloc[0]*(1+sg*SLIP/100); rp=min(max(abs(e-opp)/e*100,0.5),1.5); risk=e*rp/100
        orv=(orw.day_volume.max()-orw.day_volume.min())/300  # shares per second in the opening range
        v0=aft.day_volume.iloc[0]; b=BK.get(t['sym']); b0=None
        if b is not None:
            bb=b[b.s<=s0]; b0=bb.ratio.iloc[-1] if len(bb) else None
        r=dict(d=d,sym=t['sym'],dir=t['dir'],R=t['R'],best=t['best'],pick=(t['sym'],t['inTs']) in picked or (t['sym'] in psym and abs(min([abs(x['inTs']-t['inTs']) for x in P[d] if x['sym']==t['sym']]))<5000),rp=rp,rvol=t['rvol'])
        for c in CK:
            w=aft[aft.s<=s0+c]
            if w.empty: w=aft.iloc[:1]
            px=w.price.iloc[-1]
            r[f'r{c}']=(px-e)*sg/risk; r[f'x{c}']=(px*(1-sg*SLIP/100)-e)*sg/risk-COST/100*e/risk
            r[f'mfe{c}']=max(((w.price.max() if sg>0 else w.price.min())-e)*sg/risk,0)
            r[f'in{c}']=(px-lvl)*sg<=0
            r[f'v{c}']=(w.day_volume.iloc[-1]-v0)/max(orv*c,1)
            if b is not None and b0:
                bb=b[b.s<=s0+c]; rb=bb.ratio.iloc[-1] if len(bb) else b0
                r[f'b{c}']=(rb/b0) if sg>0 else (b0/rb)   # >1 = book moved our way
            else: r[f'b{c}']=None
            r[f'bl{c}']=None
            if b is not None:
                bb=b[b.s<=s0+c]
                if len(bb): q=bb.ratio.iloc[-1]; r[f'bl{c}']=q if sg>0 else 1/q   # buyers/sellers in our direction now
        rows.append(r)
    print(d,len(rows),flush=True)
json.dump(rows,open('early_rows.json','w'),default=float)
