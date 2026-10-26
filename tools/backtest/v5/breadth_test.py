# quick clue test: does market breadth (share of liquid stocks above their open) at the 09:20 entry agree with our trade direction?
exec(open('daytype.py').read().split("# --- 26 Oct")[0].replace("print(f\"{r['d'][5:]}","(lambda *a,**k:None)(f\"{r['d'][5:]}"))
out=[]; h5=collections.defaultdict(list)
for di,d in enumerate(DAYS):
    G=search.cache[d]; liq=[s for s,g in G.items() if not s.startswith('NIFTY') and search.liq.get(s,0)>=25]
    b920=np.mean([G[s]['c'][4]>G[s]['open'] for s in liq if np.isfinite(G[s]['c'][4])])*100
    if di:
        cand=[]
        for s,g in G.items():
            if s.startswith('NIFTY') or search.liq.get(s,0)<25 or not h5[s] or not g['has'][:5].any(): continue
            pc=search.prevclose[d].get(s)
            if not pc: continue
            r5=np.nan_to_num(g['v'])[:5].sum()/max(np.mean(h5[s][-10:]),1); orD=np.sign(g['c'][4]-g['open'])
            if r5<3 or orD==0 or (g['open']/pc-1)*100*orD>1: continue
            cand.append((r5,s,'BUY' if orD>0 else 'SELL'))
        for r5,s,D in sorted(cand,reverse=True)[:10]:
            R=trade(G[s],D)
            if R is None: continue
            agree=(b920>=50) if D=='BUY' else (b920<50)
            out.append((d,D,b920,agree,R))
    for s,g in G.items(): h5[s].append(np.nan_to_num(g['v'])[:5].sum())
def sh(l,a):
    R=[x[4] for x in a]; print(f"{l:<44} n {len(a):>3} win {np.mean([r>0 for r in R])*100:3.0f}% net {sum(R):+6.1f}R avg {np.mean(R):+.2f}")
sh('all',out); sh('trade WITH 09:20 breadth',[x for x in out if x[3]]); sh('trade AGAINST 09:20 breadth',[x for x in out if not x[3]])
sh('strong breadth (<35% or >65%), with',[x for x in out if x[3] and abs(x[2]-50)>=15]); sh('strong breadth, against',[x for x in out if not x[3] and abs(x[2]-50)>=15])
for d in DAYS[1:]:
    a=[x for x in out if x[0]==d]
    if a: print(d[5:],f"breadth 09:20 {a[0][2]:.0f}% up", ' '.join(f"{x[1][0]}{x[4]:+.1f}" for x in a))
