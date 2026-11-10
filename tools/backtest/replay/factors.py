# factors.py - step 2 inputs, NO look-ahead (only what was known before 09:15 IST of day D)
#  global: last completed session BEFORE day D for US/Europe/Asia/commodities/FX -> % change (close vs previous close)
#  news per (day, symbol): results/board meeting today, filings in the 24h before 09:15 (count + type), F&O ban today
import csv,glob,os,json,datetime as dt,collections as C
G='/mnt/user-data/uploads/live-feed/data/global'
glob_series={}
for f in glob.glob(G+'/*.csv'):
    n=os.path.basename(f)[:-4]; rows=[]
    for r in csv.DictReader(open(f)):
        try: rows.append((r['date'],float(r['close'])))
        except: pass
    rows.sort(); glob_series[n]=rows
def prev_change(n,day):
    rows=glob_series[n]; lo=[i for i,(d,c) in enumerate(rows) if d<day]
    if len(lo)<2: return None
    i=lo[-1]; return round((rows[i][1]/rows[i-1][1]-1)*100,3)
days=sorted({r[0] for r in csv.reader(open('/mnt/user-data/uploads/live-feed/data/history-news/bhav-compact.csv')) if r[0][:2]=='20'})
gf={d:{n:prev_change(n,d) for n in glob_series if n!='NIFTY_CHECK'} for d in days if d>='2022-01-01'}
json.dump(gf,open('fac/global.json','w'))
print('global days',len(gf),'example',days[-1],gf[days[-1]])
# news
M={'Jan':1,'Feb':2,'Mar':3,'Apr':4,'May':5,'Jun':6,'Jul':7,'Aug':8,'Sep':9,'Oct':10,'Nov':11,'Dec':12}
def pdate(s):
    try: d,m,y=s.split('-'); return dt.date(int(y),M[m[:3]],int(d))
    except: return None
nf=C.defaultdict(lambda:C.Counter())
dayset=set(days); daylist=sorted(dayset)
nextday={}
for i,d in enumerate(daylist[:-1]): nextday[d]=daylist[i+1]
for r in csv.reader(open('/mnt/user-data/uploads/live-feed/data/history-news/news-compact.csv')):
    if r[0]=='kind' or len(r)<5: continue
    kind,dd,tm,sym,txt=r[0],r[1],r[2],r[3],','.join(r[4:]).lower()
    if not sym: continue
    if kind=='secban': nf[(dd,sym)]['ban']+=1; continue
    d=pdate(dd)
    if not d: continue
    ds=d.isoformat()
    if kind=='board':
        if 'result' in txt: nf[(ds,sym)]['results_meeting']+=1
        else: nf[(ds,sym)]['board_other']+=1
        continue
    # filings: after 09:15 on day X count for the NEXT trading day; before 09:15 count for day X itself
    tgt=ds if (tm and tm<'09:15') else None
    if tgt is None or tgt not in dayset:
        nd=[x for x in (ds,) if x in dayset]
        tgt=nextday.get(ds) if ds in dayset else min([x for x in daylist if x>ds],default=None)
    if not tgt: continue
    k=nf[(tgt,sym)]
    if kind=='results': k['results_filed']+=1
    elif kind=='actions': k['corp_action']+=1
    else:
        k['filings']+=1
        for w,lab in [('order','order'),('award','order'),('acquisition','deal'),('merger','deal'),('rating','rating'),('resign','resign'),('fund rais','fundraise'),('preferential','fundraise'),('qip','fundraise'),('buyback','buyback'),('dividend','dividend'),('investor meet','meet'),('press release','press'),('outcome of board','board_outcome')]:
            if w in txt: k[lab]+=1
json.dump({f'{d}|{s}':dict(v) for (d,s),v in nf.items()},open('fac/news.json','w'))
print('news stock-days',len(nf)); print('sample',list(nf.items())[:3])
