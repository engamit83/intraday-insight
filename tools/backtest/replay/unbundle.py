# unbundle.py bundle.bin outdir -> one .npz per symbol: t (minutes since epoch, int32), o,h,l,c,v (float32)
import sys,gzip,io,os,numpy as np,pandas as pd
src,out=sys.argv[1],sys.argv[2]; os.makedirs(out,exist_ok=True); n=0
with open(src,'rb') as f:
    while True:
        head=f.readline()
        if not head: break
        name,ln=head.decode().rstrip('\n').split('\t'); b=f.read(int(ln))
        df=pd.read_csv(io.BytesIO(gzip.decompress(b)))
        if df.empty: continue
        t=np.array(df['time'].values,dtype='datetime64[m]').astype('int64').astype('int32')
        np.savez(os.path.join(out,name+'.npz'),t=t,o=df.open.values.astype('float32'),h=df.high.values.astype('float32'),l=df.low.values.astype('float32'),c=df.close.values.astype('float32'),v=df.volume.values.astype('float32'))
        n+=1
print('unpacked',n)
