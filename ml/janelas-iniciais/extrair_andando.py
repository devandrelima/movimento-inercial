import h5py,numpy as np,json,glob,os,sys
D='/d'
def rot_from_q(q,order):
    # q: (N,4); order 'wxyz' ou 'xyzw'
    if order=='wxyz': w,x,y,z=q.T
    else: x,y,z,w=q.T
    n=np.sqrt(w*w+x*x+y*y+z*z);w,x,y,z=w/n,x/n,y/n,z/n
    R=np.empty((len(q),3,3))
    R[:,0,0]=1-2*(y*y+z*z);R[:,0,1]=2*(x*y-z*w);R[:,0,2]=2*(x*z+y*w)
    R[:,1,0]=2*(x*y+z*w);R[:,1,1]=1-2*(x*x+z*z);R[:,1,2]=2*(y*z-x*w)
    R[:,2,0]=2*(x*z-y*w);R[:,2,1]=2*(y*z+x*w);R[:,2,2]=1-2*(x*x+y*y)
    return R
def lowpass4(x,fs,fc=12.0):
    a=1-np.exp(-2*np.pi*fc/fs);st=[x[0].copy() for _ in range(4)];out=np.empty_like(x)
    for i in range(len(x)):
        s=x[i]
        for k in range(4):
            st[k]=st[k]+a*(s-st[k]);s=st[k]
        out[i]=s
    return out
def load(seq):
    f=h5py.File(f'{D}/{seq}/data.hdf5','r')
    acce=f['synced/acce'][:];gyro=f['synced/gyro'][:];q=f['synced/game_rv'][:];pos=f['pose/tango_pos'][:,:2]
    return acce,gyro,q,pos


NSEQ=int(sys.argv[1]) if len(sys.argv)>1 else 20
seqs=sorted(os.listdir(D))[:NSEQ]
def channels(seq):
    acce,gyro,q,pos=load(seq)
    R=rot_from_q(q,'wxyz')
    aw=np.einsum('nij,nj->ni',R,acce);gw=np.einsum('nij,nj->ni',R,gyro)
    return lowpass4(np.concatenate([aw,gw],axis=1),200.0)[::4],pos[::4]
def stats(F,s,n=10):
    seg=F[s:s+n];return float(np.std(np.linalg.norm(seg[:,:3],axis=1))),float(np.mean(np.linalg.norm(seg[:,3:],axis=1)))
windows=[];info=[]
rng=np.random.default_rng(7)
for seq in seqs:
    F,P=channels(seq);n=len(F)
    speed=np.zeros(n);speed[25:]=np.hypot(*(P[25:]-P[:-25]).T)/0.5
    mov=np.zeros(n);mov[10:]=np.hypot(*(P[10:]-P[:-10]).T)/0.2
    # parado
    s=130;used=-1000
    while s<n-200:
        if mov[s-100:s+1].max()<0.15 and s-used>300:
            w=next((i for i in range(s,min(n,s+80)) if speed[i]>=0.6),None)
            if w is not None and w-s>=10:
                used=s;a,g=stats(F,s);info.append(dict(cls='parado',seq=seq,acc_std=a,gyro=g))
        s+=1
    # andando (play apertado já em movimento): velocidade alta nos 2 s anteriores e nos 2 s seguintes
    for s in range(150,n-200,160):
        if speed[s-100:s+100].min()>0.9:
            a,g=stats(F,s);ev=len(info);info.append(dict(cls='andando',seq=seq,acc_std=a,gyro=g))
            for j in (1,2,3):
                e=s+25*j-1;gt=(P[e]-P[e-25]).tolist()
                real=F[e-99:e+1];real_pad=np.concatenate([np.repeat(F[s:e+1][:1],100-(e-s+1),axis=0),F[s:e+1]],axis=0)
                windows.append(dict(seq=seq,kind='real',ev=ev,j=j,x=np.round(real,4).ravel().tolist(),gt=gt))
                windows.append(dict(seq=seq,kind='pad',ev=ev,j=j,x=np.round(real_pad,4).ravel().tolist(),gt=gt))
print('janelas',len(windows),'andando',sum(1 for i in info if i['cls']=='andando'),'parado',sum(1 for i in info if i['cls']=='parado'))
json.dump(dict(windows=windows,info=info),open('/w/walking.json','w'))
