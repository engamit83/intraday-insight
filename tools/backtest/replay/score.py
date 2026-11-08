import json,glob,sys,collections
DT=json.load(open('daytypes.json'))
def load(tag):
    r={}
    for f in glob.glob(f'days/*-{tag}.json'):
        j=json.load(open(f)); r[j['day']]=(j.get('sum') or {}).get('net') or 0
    return r
base=load('P'); tags=sys.argv[1:] or sorted({f.rsplit('-',1)[1][:-5] for f in glob.glob('days/*.json')})
print(f"{'tag':8}{'days':>5}{'net':>9}{'lose':>5}{'worst':>7}{'H1net':>8}{'H1lose':>7}{'H2net':>8}{'H2lose':>7}")
for t in tags:
    r=load(t); ds=sorted(d for d in r if d in base)
    if not ds: continue
    def st(dd): v=[r[d] for d in dd]; return sum(v),sum(x<0 for x in v),min(v)
    h=len(ds)//2; a=st(ds); b=st(ds[:h]); c=st(ds[h:]); pb=st(ds)
    print(f"{t:8}{len(ds):5}{a[0]:9.0f}{a[1]:5}{a[2]:7.0f}{b[0]:8.0f}{b[1]:7}{c[0]:8.0f}{c[1]:7}   (P same days: {sum(base[d] for d in ds):.0f}, lose {sum(base[d]<0 for d in ds)})")
