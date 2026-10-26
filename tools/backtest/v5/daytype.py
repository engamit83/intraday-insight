# Day-type study (owner 26 Oct 19:14): classify every day (trend up/down, range, reversal, gap-and-go/fill, neutral, choppy...) from Nifty 1-min,
# measure market breadth, and our SIP results per day type; look for EARLY clues (by 09:30 / 10:00) that predict the day type.
import search,sim,numpy as np,collections,json,csv
DAYS=sim.DAYS
def nifty(G):
    if 'NIFTY' in G and np.isfinite(G['NIFTY']['c']).sum()>300: return G['NIFTY']['c'],G['NIFTY']['o'],G['NIFTY']['h'],G['NIFTY']['l']
    so=np.nanmean([G[z]['so'] for z in sim.N50 if z in G],axis=0); c=100*(1+so/100); return c,c,c,c
exec(open('preopen_proxy.py').read().split("rows=[]; h1=")[0].split("import search,sim,numpy as np,collections")[1])  # trade()
rows=[]; prevc=None; h5=collections.defaultdict(list)
for di,d in enumerate(DAYS):
    G=search.cache[d]; c,o,h,l=nifty(G); c=np.array(c,float)
    op=c[0] if o is c else o[0]; cl=c[-1]; hi=np.nanmax(h if h is not c else c); lo=np.nanmin(l if l is not c else c)
    rng=hi-lo; pos=(cl-lo)/rng if rng else .5
    ib_h,ib_l=np.nanmax(c[:60]),np.nanmin(c[:60])  # initial balance = first hour
    up_ext=hi>ib_h*1.0005; dn_ext=lo<ib_l*0.9995
    gap=float(np.nanmedian([(G[z]['open']/search.prevclose[d][z]-1)*100 for z in sim.N50 if z in G and d in search.prevclose and search.prevclose[d].get(z)])) if di else np.nan; oc=(cl/op-1)*100
    m15=(c[14]/op-1)*100; m30=(c[29]/op-1)*100; m60=(c[59]/op-1)*100
    # breadth: share of liquid stocks up from their open at 09:30 / 10:15 / close
    liq=[s for s,g in G.items() if not s.startswith('NIFTY') and search.liq.get(s,0)>=25]
    br=lambda m: np.mean([G[s]['c'][m]>G[s]['open'] for s in liq if np.isfinite(G[s]['c'][m])])*100
    # choppiness: number of times Nifty crossed its VWAP-like running mean
    tw=np.cumsum(c)/np.arange(1,len(c)+1); cross=int(np.sum(np.diff(np.sign(c[5:]-tw[5:]))!=0))
    # classify
    if abs(oc)>=0.5 and ((oc>0 and pos>=0.75) or (oc<0 and pos<=0.25)): t='TREND UP' if oc>0 else 'TREND DOWN'
    elif up_ext and dn_ext: t='NEUTRAL (both sides of 1st hour)'
    elif (m60<-0.3 and oc>0.2) or (m60>0.3 and oc<-0.2): t='REVERSAL'
    elif not up_ext and not dn_ext: t='NORMAL / RANGE (inside 1st hour)'
    else: t='NORMAL VARIATION (one side extended)'
    gtype='' if not np.isfinite(gap) or abs(gap)<0.2 else ('GAP-AND-GO' if np.sign(oc)==np.sign(gap) else 'GAP-FILL')
    rows.append(dict(d=d,type=t,gap=gap,gtype=gtype,oc=oc,pos=pos,rng=rng/op*100,ib=(ib_h-ib_l)/op*100,m15=m15,m30=m30,m60=m60,
                     br930=br(14),br1015=br(60),brclose=br(359),cross=cross))
    prevc=cl
# our SIP results per day (Proposal B picks, trail-1R exit, 1-min sim)
res=collections.defaultdict(list); h5=collections.defaultdict(list)
for di,d in enumerate(DAYS):
    G=search.cache[d]
    if di:
        cand=[]
        for s,g in G.items():
            if s.startswith('NIFTY') or search.liq.get(s,0)<25 or not h5[s] or not g['has'][:5].any(): continue
            pc=search.prevclose[d].get(s); 
            if not pc: continue
            r5=np.nan_to_num(g['v'])[:5].sum()/max(np.mean(h5[s][-10:]),1); orD=np.sign(g['c'][4]-g['open'])
            if r5<3 or orD==0: continue
            gw=(g['open']/pc-1)*100*orD
            if gw>1: continue
            cand.append((r5,s,'BUY' if orD>0 else 'SELL'))
        for r5,s,D in sorted(cand,reverse=True)[:10]:
            R=trade(G[s],D)
            if R is not None: res[d].append((D,R))
    for s,g in G.items(): h5[s].append(np.nan_to_num(g['v'])[:5].sum())
for r in rows:
    t=res.get(r['d'],[]); r['n']=len(t); r['R']=sum(x[1] for x in t); r['buyR']=sum(x[1] for x in t if x[0]=='BUY'); r['sellR']=sum(x[1] for x in t if x[0]=='SELL')
    r['win']=np.mean([x[1]>0 for x in t])*100 if t else np.nan
json.dump(rows,open('daytype.json','w'),default=float)
for r in rows:
    print(f"{r['d'][5:]} {r['type']:<36} {r['gtype']:<10} gap {r['gap']:+5.2f}% open->close {r['oc']:+5.2f}% close@{r['pos']*100:3.0f}% of range | range {r['rng']:.2f}% 1st-hr {r['ib']:.2f}% | "
          f"9:30 {r['m30']:+.2f}% 10:15 {r['m60']:+.2f}% | breadth up 9:30 {r['br930']:.0f}% 10:15 {r['br1015']:.0f}% close {r['brclose']:.0f}% | VWAP crosses {r['cross']} | "
          f"SIP n {r['n']} win {r['win']:.0f}% {r['R']:+.1f}R (buy {r['buyR']:+.1f} sell {r['sellR']:+.1f})")
# --- 26 Oct (live day) from the laptop candles file
import collections as C
cd=C.defaultdict(lambda: {'o':[], 'h':[], 'l':[], 'c':[], 'm':[]})
for r in csv.DictReader(open('/mnt/user-data/uploads/live-feed/data/candles-2026-10-26.csv')):
    x=cd[r['symbol']]; x['m'].append(r['time']); x['o'].append(float(r['open'])); x['h'].append(float(r['high'])); x['l'].append(float(r['low'])); x['c'].append(float(r['close']))
def at(x,t):
    i=[j for j,m in enumerate(x['m']) if m<=t]; return x['c'][i[-1]] if i else np.nan
N=cd['NIFTY']; c=np.array(N['c']); op=N['o'][0]; cl=c[-1]; hi=max(N['h']); lo=min(N['l'])
G23=search.cache['2026-10-23']
gap=float(np.nanmedian([(cd[z]['o'][0]/G23[z]['c'][-1]-1)*100 for z in sim.N50 if z in cd and z in G23 and cd[z]['o']]))
ib=[i for i,m in enumerate(N['m']) if m<'10:15']; ibh=max(N['h'][i] for i in ib); ibl=min(N['l'][i] for i in ib)
liq=[s for s in cd if not s.startswith('NIFTY') and search.liq.get(s,0)>=25 and cd[s]['o']]
br=lambda t: np.mean([at(cd[s],t)>cd[s]['o'][0] for s in liq])*100
tw=np.cumsum(c)/np.arange(1,len(c)+1); cross=int(np.sum(np.diff(np.sign(c[5:]-tw[5:]))!=0))
print(f"10-26 (live) gap {gap:+.2f}% open->close {(cl/op-1)*100:+.2f}% close@{(cl-lo)/(hi-lo)*100:.0f}% of range | range {(hi-lo)/op*100:.2f}% 1st-hr {(ibh-ibl)/op*100:.2f}% (above 1st-hr high {hi>ibh}, below low {lo<ibl}) | "
      f"9:30 {(at(N,'09:29')/op-1)*100:+.2f}% 10:15 {(at(N,'10:14')/op-1)*100:+.2f}% | breadth up 9:30 {br('09:29'):.0f}% 10:15 {br('10:14'):.0f}% close {br('15:29'):.0f}% | VWAP crosses {cross} | SIP live 9 trades 33% win -4.9R (buy -4.8R sell -0.1R)")
