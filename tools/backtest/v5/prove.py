# prove.py - owner 1 Nov: "watch list + prove-then-enter", two-way, profit lock. 13 days of 1-min candles (13 Oct - 30 Oct, 20 Oct missing).
# Same simplified 1-min exit for EVERY variant (stop, trail 1R after +1R, stall/fast-drop/fade cut to 0.3R, 15:15) so only the entry differs.
# Walk-forward: BUILD = 13-22 Oct, CHECK = 23-30 Oct (unseen). Parameters fixed before looking at results.
import sim,numpy as np,collections,pickle,sys,json
DAYS=['2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16','2026-10-19','2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30']
CHECK='2026-10-23'; COST,SLIP,SQ=sim.COST,sim.SLIP,360
liq=sim.liquidity()
data={}
for d in DAYS:
    x=pickle.load(open(f'data/{d}.pkl','rb')); G={s:sim.grid(a) for s,a in x.items() if len(a)>150}
    if 'NIFTY' in G: nso=G['NIFTY']['so']
    else: nso=np.nanmean([G[s]['so'] for s in sim.N50 if s in G],axis=0)
    L=[s for s in G if not s.startswith('NIFTY') and liq.get(s,0)>=25]
    br=np.mean([G[s]['c']>G[s]['open'] for s in L],axis=0)*100
    data[d]=(G,nso,L,br)
def R_(t,px): return (px-t['e'])*t['sg']/t['risk']
def manage(g,t,m0,P):
    """run an open trade from minute m0; returns (exit_minute, R, best)"""
    sg=t['sg']; B=sg>0; v=g['v']
    for m in range(m0,SQ+1):
        h,l,c,o=g['h'][m],g['l'][m],g['c'][m],g['o'][m]
        if m>=SQ: return m,c,t['best']
        if (l<=t['stop'] if B else h>=t['stop']): return m,(min(t['stop'],o) if B else max(t['stop'],o)),t['best']
        t['best']=max(t['best'],R_(t,h if B else l)); r=R_(t,c)
        tight=lambda ns:(max if B else min)(t['stop'],ns)
        if t['best']>=1: t['stop']=tight(t['e']+sg*(t['best']-1)*t['risk'])
        if P.get('lock') and t['best']>=P['lock']: t['stop']=tight(t['e']+sg*t['best']*P['lockKeep']*t['risk'])
        if r<=0:
            stall=m-t['m']>=10 and t['best']<0.5
            fast=(g['c'][m-1]-c)*sg/t['risk']>=0.5
            med=np.median(v[5:m]) if m>8 else 0
            fade=med>0 and v[m-2:m+1].mean()<0.6*med and m-t['m']>=3
            if stall or fast or fade: t['stop']=tight(c-sg*0.3*t['risk'])
    return SQ,g['c'][SQ],t['best']
def open_t(e,stopPx,sg,m,P):
    e=e*(1+sg*SLIP/100); rp=min(max(abs(e-stopPx)/e*100,0.5),1.5)
    return dict(e=e,sg=sg,risk=e*rp/100,stop=e-sg*e*rp/100,best=0.0,m=m)
def result(t,x):
    f=x*(1-t['sg']*SLIP/100); return (f-t['e'])*t['sg']/t['risk']-COST/100*t['e']/t['risk']
def proof(g,nso,br,m,sg,P):
    """is the stock proving itself at the close of minute m-1? (decision for minute m)"""
    k=m-1; c=g['c'][k]
    rs=(g['so'][k]-nso[k])*sg
    if P['rs'] is not None and rs<P['rs']: return False
    if P['nochase'] and nso[k]*sg>=0.3: return False
    if P['vwap'] and (c-g['vwap'][k])*sg<=0: return False
    if P['vol']:
        med=np.median(g['v'][:k]) if k>=3 else 0
        if not(med>0 and g['v'][max(0,k-2):k+1].mean()>=P['vol']*med): return False
    if P['breadth']=='45/55':
        if sg>0 and br[k]<45: return False
        if sg<0 and br[k]>55: return False
    if P['breadth']=='55rise':
        ch=br[k]-br[max(0,k-5)]
        if sg>0 and not(br[k]>=55 and ch>0): return False
        if sg<0 and not(br[k]<=45 and ch<0): return False
    return True
def run(P):
    hist=collections.defaultdict(list); out=[]
    prev=None
    for d in DAYS:
        G,nso,L,br=data[d]
        if prev is not None:
            cand=[]
            for s in L:
                g=G[s]
                if not hist[s] or not g['has'][:5].any(): continue
                rv=g['v'][:5].sum()/max(np.mean(hist[s][-10:]),1); o=g['open']; c=g['c'][4]
                if c==o or rv<P['rvol']: continue
                sg=1 if c>o else -1; pc=prev.get(s); gw=(o/pc-1)*100*sg if pc else 0.0
                if gw>1: continue
                cand.append((rv,s,sg,gw))
            cand.sort(reverse=True)
            for rv,s,sg,gw in cand[:P['K']]:
                g=G[s]; B=sg>0
                size=1.5 if (gw<0 and rv>=5) else 0.5 if 0<gw<=1 else 1.0
                orh,orl=g['h'][:5].max(),g['l'][:5].min()
                trades=[]; m=5; dirs=[sg]; used=set()
                while dirs and m<SQ:
                    sg2=dirs.pop(0); B=sg2>0; t=None
                    for mm in range(m,min(P['last'],SQ)):
                        if P['mode']=='break':
                            lvl=orh if B else orl
                            if not (g['h'][mm]>lvl if B else g['l'][mm]<lvl): continue
                            if P['breadth']=='45/55' and ((B and br[mm-1]<45) or (not B and br[mm-1]>55)): continue
                            if not proof(g,nso,br,mm,sg2,P): continue
                            t=open_t(max(lvl,g['o'][mm]) if B else min(lvl,g['o'][mm]),orl if B else orh,sg2,mm,P); break
                        else:  # prove: break of the last-15-min level while the stock proves itself
                            lo=max(0,mm-15); lvl=g['h'][lo:mm].max() if B else g['l'][lo:mm].min()
                            if not (g['h'][mm]>lvl if B else g['l'][mm]<lvl): continue
                            if not proof(g,nso,br,mm,sg2,P): continue
                            sw=g['l'][max(0,mm-10):mm].min() if B else g['h'][max(0,mm-10):mm].max()
                            t=open_t(max(lvl,g['o'][mm]) if B else min(lvl,g['o'][mm]),sw,sg2,mm,P); break
                    if t is None: break
                    # same-minute stop hit
                    xm,x,best=manage(g,t,t['m'],P); r=result(t,x)
                    out.append(dict(d=d,s=s,dir=sg2,R=r,Rs=r*1000*size,best=best,m=t['m'],first=sg2==sg))
                    used.add(sg2); m=xm+1
                    if P['two'] and r<0 and -sg2 not in used: dirs.append(-sg2)
        prev={s:g['c'][-1] for s,g in G.items()}
        for s,g in G.items(): hist[s].append(g['v'][:5].sum())
    return out
def show(name,tr):
    if not tr: print(f'{name:<44} no trades'); return
    by=collections.defaultdict(float)
    for t in tr: by[t['d']]+=t['Rs']
    b=sum(t['Rs'] for t in tr if t['d']<CHECK); c=sum(t['Rs'] for t in tr if t['d']>=CHECK)
    L=[t['Rs'] for t in tr if t['Rs']<0]
    print(f"{name:<44} n {len(tr):>3} | our way first {np.mean([t['best']>=0.5 for t in tr])*100:3.0f}% | against at once {np.mean([t['best']<0.2 for t in tr])*100:3.0f}% | win {np.mean([t['R']>0 for t in tr])*100:3.0f}% | avg loss {np.mean(L) if L else 0:6.0f} worst {min(t['Rs'] for t in tr):6.0f} | losing days {sum(v<0 for v in by.values())}/{len(by)} | NET Rs {sum(by.values()):+7.0f} (build {b:+6.0f} / unseen {c:+6.0f})")
    return dict(net=sum(by.values()),build=b,check=c)
