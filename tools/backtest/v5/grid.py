import sim,copy,sys
liq=sim.liquidity()
def V(**kw):
    p=copy.deepcopy(sim.P); p.update(kw); return p
variants=[('v5 base',V()),
 ('regime: opening-range break',V(regime='orb')),
 ('regime: none',V(regime='none')),
 ('entry: chase new high/low',V(entry='chase')),
 ('no sector check',V(sector=False)),
 ('no pullback-volume check',V(pb_vol=False)),
 ('no candle check',V(candle=False)),
 ('min stop 0.5%',V(stop_min=0.5)),
 ('no trail (keep be)',V(trail=False)),
 ('no partial',V(partial=False)),
 ('no time stop',V(time_stop=0)),
 ('target 2R no partial no trail',V(partial=False,trail=False,target_R=2.0)),
 ('min stop 0.5 + no trail',V(stop_min=0.5,trail=False)),
 ('rs >=1.0',V(rs_min=1.0)),
]
for name,p in variants:
    tr=sim.run(p,liq=liq); sim.report(tr,name)
