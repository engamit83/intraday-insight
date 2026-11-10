import json,glob,os,collections as C,sys
# Step 1 scorer: per variant per year: trades, before-cost, after-cost, losing days, worst day
V=[v[0] for v in json.load(open('step1.json'))]
def tcost(t):  # costPct 0.10628% of entry notional + 2*0.02% slippage (already inside prices)
    notional=1000*(t.get('mult') or 1)*100/max(t.get('riskPct') or 1.5,0.1)
    return notional*(0.0010628+0.0004)
R={}
for v in V:
    for f in glob.glob(f'mdays2/20*-{v}.json'):
        b=os.path.basename(f); day=b[:10]
        if b[11:-5]!=v: continue
        d=json.load(open(f)); tr=d.get('trades') or []
        R[(v,day)]=(sum(t['net'] for t in tr), sum(t['net']+tcost(t) for t in tr), len(tr), sum(t['net']>0 for t in tr))
days=sorted({d for (_,d) in R})
Y=['2022','2023','2024','2025','2026']
# only days complete for all variants
full=[d for d in days if all((v,d) in R for v in V)]
def agg(v,dd):
    x=[R[(v,d)] for d in dd]
    if not x: return None
    net=sum(a[0] for a in x); gro=sum(a[1] for a in x); n=sum(a[2] for a in x); w=sum(a[3] for a in x)
    return dict(net=net,gross=gro,n=n,win=w/max(n,1),lose=sum(a[0]<0 for a in x),worst=min(a[0] for a in x),days=len(x),gpt=gro/max(n,1))
out={}
for v in V:
    out[v]={y:agg(v,[d for d in full if d[:4]==y]) for y in Y}
    out[v]['22-24']=agg(v,[d for d in full if d[:4]<'2025']); out[v]['25-26']=agg(v,[d for d in full if d[:4]>='2025'])
json.dump(out,open('step1-score.json','w'))
print('days complete per year:',{y:sum(d[:4]==y for d in full) for y in Y})
print(f"{'variant':15}"+''.join(f"{y:>9}" for y in Y)+f"{'22-24':>9}{'25-26':>9} {'lose22-24':>9}{'lose25-26':>9} {'gross/tr':>8} {'trades/yr':>9}")
for v in V:
    o=out[v]; g=o['22-24'] or {}; h=o['25-26'] or {}
    print(f"{v:15}"+''.join(f"{(o[y] or {}).get('net',0):9.0f}" for y in Y)+f"{g.get('net',0):9.0f}{h.get('net',0):9.0f} {g.get('lose',0):9}{h.get('lose',0):9} {(o['25-26'] or {}).get('gpt',0):8.0f} {sum((o[y] or {}).get('n',0) for y in Y)/5:9.0f}")
