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
windows=[];events=[];fit_count=0
def channels(seq):
    acce,gyro,q,pos=load(seq)
    R=rot_from_q(q,'wxyz')
    aw=np.einsum('nij,nj->ni',R,acce);gw=np.einsum('nij,nj->ni',R,gyro)
    x=np.concatenate([aw,gw],axis=1)
    f=lowpass4(x,200.0)[::4];P=pos[::4]
    return f,P
def win(F,e):  # janela real terminando em e (100 amostras)
    return F[e-99:e+1]
def padded(F,s,e):  # amostras reais F[s..e], prefixo = cópia de F[s]
    real=F[s:e+1];n=100-len(real)
    return np.concatenate([np.repeat(real[:1],n,axis=0),real],axis=0)
for seq in seqs:
    F,P=channels(seq);n=len(F)
    # janelas de ajuste do referencial (a cada 1 s) para estimar a rotação entre o referencial do jogo e o do Tango
    for e in range(100,n-1,50):
        windows.append(dict(seq=seq,kind='fit',e=e,x=np.round(win(F,e),4).ravel().tolist(),gt=(P[e]-P[e-25]).tolist()))
    speed=np.zeros(n);speed[25:]=np.hypot(*(P[25:]-P[:-25]).T)/0.5
    mov=np.zeros(n);mov[10:]=np.hypot(*(P[10:]-P[:-10]).T)/0.2
    s=130;used=-1000
    while s<n-200:
        still=mov[s-100:s+1].max()<0.15
        if still and s-used>300:
            w=next((i for i in range(s,min(n,s+80)) if speed[i]>=0.6),None)
            if w is not None and w-s>=10:
                ev=len(events);events.append(dict(seq=seq,s=s,w=w));used=s
                for j in range(1,7):
                    e=s+25*j-1
                    gt=(P[e]-P[e-25]).tolist()
                    windows.append(dict(seq=seq,kind='real',ev=ev,j=j,e=e,x=np.round(win(F,e),4).ravel().tolist(),gt=gt))
                    if j<4:windows.append(dict(seq=seq,kind='pad',ev=ev,j=j,e=e,x=np.round(padded(F,s,e),4).ravel().tolist(),gt=gt))
        s+=1
print('janelas',len(windows),'eventos',len(events),'por sequência',{sq:sum(1 for ev in events if ev['seq']==sq) for sq in seqs})
json.dump(dict(windows=windows,events=events),open('/w/windows.json','w'))
