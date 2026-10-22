# v5 intraday rules simulator on 1-minute bars (paper research, 22 Oct). Parameters fixed BEFORE looking at results.
import pickle,csv,collections,numpy as np,sys,json
DAYS=['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-19','2026-10-21','2026-10-22']
N50=open('n50.txt').read().split()[:49]
SECTOR=dict(l.split() for l in open('sectors.txt'))
COST=0.10628; SLIP=0.02; RISK_RS=1000; SQ=360  # 15:15
P=dict(regime='twap', reg_min=0.2, rs_min=0.5, sector=True, pullback=True, pb_vol=True, candle=True, max_ext=1.2,
       stop_min=0.25, stop_max=1.2, partial=True, target_R=3.0, time_stop=30, windows=[(30,135),(255,330)],
       max_dir=3, max_day=8, liq_cr=25, max_spread=0.10, book=False, entry='pullback', trail=True)

def ffill(a):
    for i in range(1,len(a)):
        if np.isnan(a[i]): a[i]=a[i-1]
    return a
def grid(a):  # -> dict of 375-length arrays (ffilled close; nan-free where data exists)
    G={k:np.full(375,np.nan) for k in 'ohlcv'}
    for m,o,h,l,c,v in a:
        m=int(m); G['o'][m],G['h'][m],G['l'][m],G['c'][m],G['v'][m]=o,h,l,c,v
    has=~np.isnan(G['c']); G['has']=has
    G['c']=ffill(G['c'].copy())
    for k in 'ohl': G[k]=np.where(has,G[k],G['c'])
    G['v']=np.where(has,G['v'],0.0)
    tp=(G['h']+G['l']+G['c'])/3; cv=np.cumsum(G['v']); G['vwap']=np.where(cv>0,np.cumsum(tp*G['v'])/np.maximum(cv,1e-9),G['c'])
    G['twap']=np.cumsum(tp)/np.arange(1,376)
    G['open']=G['o'][np.argmax(has)] if has.any() else np.nan
    G['so']=(G['c']/G['open']-1)*100
    return G

def load_day(d):
    x=pickle.load(open(f'data/{d}.pkl','rb'))
    G={s:grid(a) for s,a in x.items() if len(a)>200}
    if 'NIFTY' in G: mk=G['NIFTY']
    else:
        so=np.nanmean([G[s]['so'] for s in N50 if s in G],axis=0)
        mk={'so':so,'c':100*(1+so/100)}; mk['twap']=np.cumsum(mk['c'])/np.arange(1,376)
        mk['h']=mk['l']=mk['c']
    book=None
    try:
        book=collections.defaultdict(dict)
        for r in csv.DictReader(open(f'/mnt/user-data/uploads/live-feed/data/book-{d}.csv')):
            m=(int(r['time'][:2])*60+int(r['time'][3:5]))-555
            try:
                b,o=float(r['bid']),float(r['offer']); tb,ts=float(r['total_buy_qty']),float(r['total_sell_qty'])
                book[r['symbol']][m]=((o-b)/((o+b)/2)*100 if b>0 and o>b else np.nan, tb/ts if ts>0 else np.nan)
            except: pass
    except FileNotFoundError: book=None
    return G,mk,book

# liquidity: median full-day turnover (crore) across the history days
def liquidity():
    tv=collections.defaultdict(list)
    for d in DAYS[:6]:
        x=pickle.load(open(f'data/{d}.pkl','rb'))
        for s,a in x.items(): tv[s].append(float((a[:,4]*a[:,5]).sum())/1e7)
    return {s:np.median(v) for s,v in tv.items()}

def regime(mk,m,p):
    c,so,tw=mk['c'][m],mk['so'][m],mk['twap'][m]
    if p['regime']=='none': return {'BUY','SELL'}
    if p['regime']=='orb':
        orh,orl=np.nanmax(mk['h'][:30]),np.nanmin(mk['l'][:30])
        return ({'BUY'} if c>orh and c>tw else set()) | ({'SELL'} if c<orl and c<tw else set())
    out=set()
    if c>tw and so>=p['reg_min']: out.add('BUY')
    if c<tw and so<=-p['reg_min']: out.add('SELL')
    return out

def signal(G,s,m,D,p,mkso,secso):
    g=G[s]; B=D=='BUY'; sg=1 if B else -1
    if not g['has'][m]: return None
    rs=(g['so'][m]-mkso)*sg
    if rs<p['rs_min']: return None
    if p['sector'] and secso is not None and (secso-mkso)*sg<0: return None
    c,vw=g['c'][m],g['vwap'][m]
    if (c-vw)*sg<=0: return None
    if (c/vw-1)*100*sg>p['max_ext']: return None
    if p['entry']=='chase':  # old style: buy a new day high / sell a new day low immediately
        prev=np.max(g['h'][:m]) if B else np.min(g['l'][:m])
        if (c-prev)*sg<=0: return None
        stop=c*(1-sg*max(p['stop_min'],min(p['stop_max'],0.6))/100)
        return dict(stop=stop,rs=rs)
    # impulse extreme in the last 30 bars (not the last 2), pullback since, turn now
    lo=max(1,m-30)
    seg_h=g['h'][lo:m-1] if B else -g['l'][lo:m-1]
    if len(seg_h)<5: return None
    k=lo+int(np.argmax(seg_h)); ext=g['h'][k] if B else g['l'][k]
    dayext=np.max(g['h'][:m]) if B else np.min(g['l'][:m])
    if (ext-dayext)*sg<0: return None                     # the impulse must be the day's extreme
    pb=slice(k+1,m)                                        # pullback bars
    if m-k-1<2: return None
    pbx=np.min(g['l'][pb]) if B else np.max(g['h'][pb])    # pullback low (BUY)
    depth=(ext-pbx)*sg; room=(ext-vw)*sg
    if room<=0 or depth<0.3*room: return None              # real pullback: at least 30% of the way back to VWAP
    if (pbx-vw)*sg<-0.0005*c: return None                  # but held VWAP
    if p['pb_vol']:
        imp=g['v'][max(0,k-10):k+1].mean(); pv=g['v'][pb].mean()
        if not(pv<imp): return None                       # pullback on lighter volume than the push
    # turn: this bar closes beyond the previous bar's extreme
    if B and not c>g['h'][m-1]: return None
    if not B and not c<g['l'][m-1]: return None
    if p['candle']:
        rng=g['h'][m]-g['l'][m]
        if rng<=0: return None
        pos=(c-g['l'][m])/rng if B else (g['h'][m]-c)/rng
        if pos<0.7: return None                            # strong close
    stop=pbx*(1-sg*0.0005)
    return dict(stop=stop,rs=rs)

def run(p=P,days=DAYS,verbose=False,liq=None):
    liq=liq or liquidity(); res=[]
    for d in days:
        G,mk,book=load_day(d)
        if p['book'] and not book: continue
        secs=collections.defaultdict(list)
        for s in G:
            if s in SECTOR and not s.startswith('NIFTY'): secs[SECTOR[s]].append(s)
        open_t=[]; done=set(); ntr=0; trades=[]
        for m in range(30,SQ+1):
            # manage open trades on bar m
            for t in list(open_t):
                g=G[t['s']]; B=t['D']=='BUY'; sg=1 if B else -1
                h,l,c,o=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
                fav=(h if B else l); adv=(l if B else h)
                def close(px,why,frac=None):
                    frac=t['left'] if frac is None else frac
                    fill=px*(1-sg*SLIP/100)
                    t['R']+=frac*((fill-t['entry'])*sg/t['risk'] - (COST/100)*t['entry']/t['risk'])
                    t['left']-=frac
                    if t['left']<=1e-9: t['why']=why; t['out']=m; open_t.remove(t); trades.append(t)
                if m>=SQ: close(o if m>SQ else c,'15:15'); continue
                if (adv-t['stop'])*sg<=0: close(min(t['stop'],o) if B else max(t['stop'],o),'stop' if not t['be'] else 'trail/be'); continue
                t['best']=max(t['best'],(fav-t['entry'])*sg/t['risk'])
                if p['partial'] and not t['half'] and t['best']>=1:
                    close(t['entry']+sg*t['risk'],'half',0.5); t['half']=True
                if t['best']>=1 and not t['be']:
                    t['stop']=t['entry']*(1+sg*(COST+2*SLIP)/100); t['be']=True
                tgt=t['entry']+sg*p['target_R']*t['risk']
                if (fav-tgt)*sg>=0 and t in open_t: close(tgt,'target'); continue
                if p['trail'] and t['be'] and t in open_t:
                    sw=np.min(g['l'][m-4:m+1]) if B else np.max(g['h'][m-4:m+1])
                    if (sw-t['stop'])*sg>0: t['stop']=sw
                if p['time_stop'] and m-t['in']>=p['time_stop'] and t['best']<0.5 and t in open_t: close(c,'time')
            if m>=SQ or ntr>=p['max_day']: continue
            if not any(a<=m<=b for a,b in p['windows']): continue
            allowed=regime(mk,m,p)
            mkso=mk['so'][m]
            cands=[]
            for D in allowed:
                if sum(1 for t in open_t if t['D']==D)>=p['max_dir']: continue
                for s,g in G.items():
                    if s.startswith('NIFTY') or s in done or s not in SECTOR: continue
                    if liq.get(s,0)<p['liq_cr']: continue
                    others=[G[z]['so'][m] for z in secs[SECTOR[s]] if z!=s and z in G]
                    secso=float(np.median(others)) if len(others)>=2 else None
                    sig=signal(G,s,m,D,p,mkso,secso)
                    if not sig: continue
                    if book is not None and s in book:
                        bk=[book[s][k] for k in (m,m-1,m+1) if k in book[s]]
                        if bk:
                            spr,ratio=bk[0]
                            if p['max_spread'] and not np.isnan(spr) and spr>p['max_spread']: continue
                            if p['book'] and not np.isnan(ratio) and ((D=='BUY' and ratio<0.9) or (D=='SELL' and ratio>1/0.9)): continue
                    cands.append((sig['rs'],s,D,sig))
            for rs,s,D,sig in sorted(cands,reverse=True):
                if ntr>=p['max_day'] or sum(1 for t in open_t if t['D']==D)>=p['max_dir']: break
                g=G[s]; sg=1 if D=='BUY' else -1
                if m+1>=SQ: break
                entry=g['o'][m+1]*(1+sg*SLIP/100); risk=(entry-sig['stop'])*sg
                rp=risk/entry*100
                if not(p['stop_min']<=rp<=p['stop_max']): continue
                open_t.append(dict(s=s,D=D,day=d,in_=m,**{'in':m+1},entry=entry,stop=sig['stop'],risk=risk,R=0.0,left=1.0,best=0.0,half=False,be=False))
                done.add(s); ntr+=1
        res+=trades
    return res

def report(tr,label):
    by=collections.defaultdict(list)
    for t in tr: by[t['day']].append(t)
    tot=sum(t['R'] for t in tr); n=len(tr); won=sum(1 for t in tr if t['best']>=1)
    line=f"{label:<34} trades {n:>3}  reached+1R {won:>3} ({(100*won/n if n else 0):>3.0f}%)  net {tot:+6.1f}R = Rs{tot*RISK_RS:+8,.0f} | "
    line+=' '.join(f"{d[8:]}:{sum(t['R'] for t in v):+.1f}({len(v)})" for d,v in sorted(by.items()))
    print(line); return tot
if __name__=='__main__':
    tr=run(); report(tr,'v5 base')
    for t in tr: print(t['day'][5:],t['s'],t['D'],'in',f"{(t['in']+555)//60:02d}:{(t['in']+555)%60:02d}",'out',f"{(t['out']+555)//60:02d}:{(t['out']+555)%60:02d}",t['why'],f"{t['R']:+.2f}R",f"risk {t['risk']/t['entry']*100:.2f}%")
