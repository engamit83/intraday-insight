# LIVE-TICK FACTOR DATASET (owner 11 Nov 17:02): all stocks, our recorded tick days. Adds ORDER FLOW, which old data does not have.
# Per tick: traded qty = rise in day_volume; buyer-initiated if price >= previous offer, seller-initiated if <= previous bid,
# else by tick direction. Per minute: buy qty, sell qty, average book imbalance bid_qty/(bid_qty+offer_qty), spread.
# Per minute x direction (09:20-14:45): factors known at that minute + outcomes (clean 2% / trade +2% target, 0.5% stop, 15:15).
import pandas as pd, numpy as np, sys, glob, os
day=sys.argv[1]; f=f'/mnt/user-data/uploads/live-feed/data/ticks-{day}.csv'
df=pd.read_csv(f,dtype={'symbol':str}); df=df[df['price']>0]
t=df['time'].str
df['m']=t.slice(0,2).astype(int)*60+t.slice(3,5).astype(int)
df=df[(df['m']>=555)&(df['m']<=929)].copy()
rows=[]
for sym,g in df.groupby('symbol',sort=False):
    if len(g)<500: continue
    p=g['price'].to_numpy(float); dv=np.diff(g['day_volume'].to_numpy(float),prepend=g['day_volume'].iloc[0]); dv[dv<0]=0
    pb=np.r_[np.nan,g['bid'].to_numpy(float)[:-1]]; pa=np.r_[np.nan,g['offer'].to_numpy(float)[:-1]]
    tick=np.sign(np.diff(p,prepend=p[0]))
    side=np.where(p>=pa,1,np.where(p<=pb,-1,tick))
    bq=g['bid_qty'].to_numpy(float); aq=g['offer_qty'].to_numpy(float); imb=bq/np.maximum(bq+aq,1)
    spr=(g['offer'].to_numpy(float)-g['bid'].to_numpy(float))/p*100
    m=g['m'].to_numpy()-555
    H=np.full(375,np.nan); Lw=np.full(375,np.nan); Cl=np.full(375,np.nan); BV=np.zeros(375); SV=np.zeros(375); V=np.zeros(375); IM=np.full(375,np.nan); SP=np.full(375,np.nan)
    s=pd.DataFrame({'m':m,'p':p,'dv':dv,'side':side,'imb':imb,'spr':spr})
    a=s.groupby('m').agg(h=('p','max'),l=('p','min'),c=('p','last'),v=('dv','sum'),imb=('imb','mean'),spr=('spr','median'))
    bs=s.assign(b=np.where(s.side>0,s.dv,0),se=np.where(s.side<0,s.dv,0)).groupby('m')[['b','se']].sum()
    idx=a.index.to_numpy(); H[idx]=a.h; Lw[idx]=a.l; Cl[idx]=a.c; V[idx]=a.v; IM[idx]=a.imb; SP[idx]=a.spr; BV[bs.index]=bs.b; SV[bs.index]=bs.se
    for q in range(1,375):
        if np.isnan(Cl[q]): Cl[q]=Cl[q-1]; H[q]=Cl[q]; Lw[q]=Cl[q]
    if np.isnan(Cl[0]) or np.isnan(Cl[360]): continue
    op=Cl[0] if np.isnan(H[0]) else p[0]
    hi=np.fmax.accumulate(H); lo=np.fmin.accumulate(Lw); cv=np.cumsum(V)
    cb=np.cumsum(BV); cs=np.cumsum(SV)
    def win(a,i,n): return a[max(i-n+1,0):i+1].sum()
    for i in range(5,331):
        e=Cl[i]
        b5,s5=win(BV,i,5),win(SV,i,5); b15,s15=win(BV,i,15),win(SV,i,15)
        v15=win(V,i,15); avgm=cv[i]/(i+1)
        for dr in (1,-1):
            fav=(H[i+1:361]/e-1)*100 if dr==1 else (1-Lw[i+1:361]/e)*100
            adv=(1-Lw[i+1:361]/e)*100 if dr==1 else (H[i+1:361]/e-1)*100
            s05=np.nonzero(adv>=0.05)[0]; s05=s05[0] if len(s05) else 999
            w=np.nonzero(fav>=2.0)[0]; w=w[0] if len(w) else 999
            s5_=np.nonzero(adv>=0.5)[0]; s5_=s5_[0] if len(s5_) else 999
            tr=2.0 if w<s5_ else (-0.5 if s5_<999 else (Cl[360]/e-1)*100*dr)
            rows.append((sym,555+i,dr,int(w<s05),tr,
              dr*(b5-s5)/max(b5+s5,1), dr*(b15-s15)/max(b15+s15,1), dr*(cb[i]-cs[i])/max(cb[i]+cs[i],1),
              (np.nanmean(IM[max(i-4,0):i+1])-0.5)*dr, np.nanmedian(SP[max(i-4,0):i+1]),
              dr*(e/Cl[max(i-15,0)]-1)*100, dr*(e/op-1)*100,
              ((e-lo[i])/max(hi[i]-lo[i],1e-9)) if dr==1 else ((hi[i]-e)/max(hi[i]-lo[i],1e-9)),
              v15/max(avgm*15,1), (hi[i]/lo[i]-1)*100))
cols=['sym','time','dir','clean','tr','of5','of15','ofDay','bookImb','spread','mom15','fromOpen','posInDay','vol15rel','rangeSoFar']
out=pd.DataFrame(rows,columns=cols); out.insert(0,'day',day); out.to_pickle(f'tf-{day}.pkl')
print(day,'stocks',out.sym.nunique(),'rows',len(out),'clean',int(out.clean.sum()))
