# BUYERS vs SELLERS at the breakout (owner 12 Nov 21:31) [TICK, 8 Sharekhan days with book snapshots].
# Events: for every liquid stock (turnover >= Rs25 cr), the FIRST tick beyond its 09:15-09:20 high (buy) or low (sell) between 09:20 and 10:15
# (= our entry trigger, either side, no other filters) + separately our real BASE entries.
# Outcome (entry judged alone): clean >=1.5% / >=2% = price goes that far our way before coming back to the breakout price (0.05% tolerance), until 15:15.
# Factor: book = total buy qty / total sell qty at the last snapshot before the breakout, turned to OUR side (sell trades: sell/buy).
# PASS MARK (written before looking): the strongest-book group must be clearly cleaner than all events in BOTH halves of the days.
import json, numpy as np, pandas as pd, statistics as st, sys
days=['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-06']
D='/mnt/user-data/uploads/live-feed/data/'
ev=[]
for day in days:
    b=json.load(open(f'cb-{day}.json')); liq={s for s,v in b['turnover'].items() if v and st.median(v)>=25}
    df=pd.read_csv(f'tmp/to-{day}.csv',usecols=['time','symbol','price']); df=df[df.symbol.isin(liq)&(df.price>0)&(df.time<'15:15:00')]
    df['s']=df.time.str.slice(0,2).astype(int)*3600+df.time.str.slice(3,5).astype(int)*60+df.time.str.slice(6).astype(float)
    bk=pd.read_csv(D+f'book-{day}.csv'); bk=bk[bk.symbol.isin(liq)]
    bk['s']=bk.time.str.slice(0,2).astype(int)*3600+bk.time.str.slice(3,5).astype(int)*60+bk.time.str.slice(6,8).astype(int)
    BK={s:g.sort_values('s') for s,g in bk.groupby('symbol')}
    tr={(x['sym']) for x in json.load(open(f'tickdir-{day}.json'))['D0']['trades'] if x.get('re',0)==0}
    for sym,g in df.groupby('symbol'):
        s=g.s.to_numpy(); p=g.price.to_numpy()
        o=(s>=33300)&(s<33600)
        if o.sum()<5 or sym not in BK: continue
        hi,lo=p[o].max(),p[o].min()
        w=np.nonzero((s>=33600)&(s<36900)&((p>hi)|(p<lo)))[0]
        if not len(w): continue
        k=w[0]; sg=1 if p[k]>hi else -1; base=hi if sg==1 else lo
        after=p[k+1:]; fav=sg*(after/base-1)*100
        back=np.nonzero(fav<=-0.05)[0]; bb=back[0] if len(back) else 10**9
        c={}
        for x in (1.5,2.0):
            ww=np.nonzero(fav>=x)[0]; c[x]=int((ww[0] if len(ww) else 10**9)<bb)
        B=BK[sym]; j=np.searchsorted(B.s.to_numpy(),s[k],side='right')-1
        if j<0: continue
        r=B.iloc[j]; tb,ts_=float(r.total_buy_qty),float(r.total_sell_qty)
        if not(tb>0 and ts_>0): continue
        ratio=(tb/ts_) if sg==1 else (ts_/tb)
        # change of the book over the previous 5 snapshots (~5 min): rising pressure our way?
        j0=max(j-5,0); r0=B.iloc[j0]; ratio0=((r0.total_buy_qty/r0.total_sell_qty) if sg==1 else (r0.total_sell_qty/r0.total_buy_qty)) if r0.total_buy_qty>0 and r0.total_sell_qty>0 else np.nan
        ev.append(dict(day=day,sym=sym,dir='BUY' if sg==1 else 'SELL',t=s[k],c15=c[1.5],c20=c[2.0],book=ratio,bookChg=ratio/ratio0 if ratio0==ratio0 else np.nan,ours=int(sym in tr)))
    print(day,'events',sum(1 for e in ev if e['day']==day),flush=True)
E=pd.DataFrame(ev); E.to_csv('bookq-events.csv',index=False)
h1=set(days[:4])
def show(name,S):
    a=S[S.day.isin(h1)]; b=S[~S.day.isin(h1)]
    return f"{name:38} n {len(S):5} clean1.5 {100*S.c15.mean():5.1f}% clean2 {100*S.c20.mean():5.1f}% | half1 {100*a.c15.mean():5.1f}% (n{len(a)}) half2 {100*b.c15.mean():5.1f}% (n{len(b)})"
print('\nALL LIQUID-STOCK BREAKOUTS (first break of the 09:15-09:20 range, 09:20-10:15, either side)')
print(show('all events',E))
for lo_,hi_,nm in [(0,0.5,'book < 0.5 (strongly against us)'),(0.5,0.8,'0.5-0.8'),(0.8,1.25,'0.8-1.25 (balanced)'),(1.25,2,'1.25-2'),(2,1e9,'book >= 2 (strongly with us)')]:
    print(show(nm,E[(E.book>=lo_)&(E.book<hi_)]))
q=E.book.quantile([.2,.4,.6,.8]).to_list(); print('  quintile edges',[round(x,2) for x in q])
for i,(lo_,hi_) in enumerate(zip([0]+q,q+[1e9])): print(show(f'  book quintile {i+1}',E[(E.book>=lo_)&(E.book<hi_)]))
print('\nBOOK CHANGE over ~5 min before the break (rising pressure our way = >1)')
for lo_,hi_,nm in [(0,0.8,'falling < 0.8'),(0.8,1.25,'flat'),(1.25,1e9,'rising >= 1.25')]: print(show(nm,E[(E.bookChg>=lo_)&(E.bookChg<hi_)]))
print('\nBY SIDE'); [print(show(f'{d} all',E[E.dir==d])) or print(show(f'{d} book>=2',E[(E.dir==d)&(E.book>=2)])) for d in ('BUY','SELL')]
print('\nOUR REAL BASE FIRST ENTRIES among these events'); O=E[E.ours==1]; print(show('ours all',O)); print(show('ours book>=1.25',O[O.book>=1.25])); print(show('ours book<1.25',O[O.book<1.25]))
