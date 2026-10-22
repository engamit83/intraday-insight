import sim,copy
liq=sim.liquidity()
def V(**kw):
    p=copy.deepcopy(sim.P); p.update(kw); return p
for name,p in [('v5 base',V()),('orb+rs1+stop0.6',V(regime='orb',rs_min=1.0,stop_min=0.6)),('orb+rs1+stop0.8',V(regime='orb',rs_min=1.0,stop_min=0.8,stop_max=1.6))]:
    tr=sim.run(p,liq=liq)
    costR=sum((sim.COST+2*sim.SLIP)/100*t['entry']/t['risk'] for t in tr)
    net=sum(t['R'] for t in tr)
    risk=sorted(t['risk']/t['entry']*100 for t in tr)
    build=[t for t in tr if t['day']<'2026-10-19']; chk=[t for t in tr if t['day']>='2026-10-19']
    print(f"{name:<20} n {len(tr)} net {net:+.1f}R  costs {costR:.1f}R  => before costs {net+costR:+.1f}R | median stop {risk[len(risk)//2]:.2f}% | build days {sum(t['R'] for t in build):+.1f}R ({len(build)})  check days {sum(t['R'] for t in chk):+.1f}R ({len(chk)})")
