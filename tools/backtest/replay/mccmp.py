import json,subprocess,glob
b=dict(json.load(open('step1.json')))['S-BASE']
days=sorted(f[5:-4] for f in glob.glob('mc/A-*.csv'))
T={'A':0,'B':0}; same=0; tot=0; ld={'A':0,'B':0}
for day in days:
    R={}
    for k in 'AB':
        r=subprocess.run(['node','/home/claude/work/rp.mjs',f'mc/{k}-{day}.csv',f'cb-{day}.json',day,'',json.dumps(b)],capture_output=True,text=True)
        R[k]=json.loads(r.stdout.strip().split('\n')[-1])
    ta=[(t['sym'],t['dir'],t['reason'],t['net']) for t in R['A']['trades']]; tb=[(t['sym'],t['dir'],t['reason'],t['net']) for t in R['B']['trades']]
    sa={x[:2] for x in ta}; sb={x[:2] for x in tb}; same+=len(sa&sb); tot+=len(sa|sb)
    for k in 'AB': T[k]+=R[k]['sum']['net']; ld[k]+=R[k]['sum']['net']<0
    print(day,'A',R['A']['sum']['n'],R['A']['sum']['net'],'| B',R['B']['sum']['n'],R['B']['sum']['net'],'| picks same',len({p['sym'] for p in R['A']['picks']}&{p['sym'] for p in R['B']['picks']}),'/',len(R['A']['picks']))
    for x in ta:
        y=[q for q in tb if q[:2]==x[:2]]; print('   A',x,'B',y[0] if y else '-')
    for y in tb:
        if y[:2] not in sa: print('   A -  B',y)
print('TOTAL A(ticks->minute close)',T['A'],'losing',ld['A'],'| B(Zerodha candles)',T['B'],'losing',ld['B'],'| same trades',same,'/',tot)
