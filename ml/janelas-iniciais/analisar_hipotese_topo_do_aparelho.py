import json,numpy as np,h5py
exec(open('/w/extract.py').read().split("NSEQ=")[0])  # reaproveita rot_from_q e load
d=json.load(open('/w/windows.json'));out=np.array(json.load(open('/w/outputs.json')))
W=d['windows'];E=d['events']
seq=np.array([w['seq'] for w in W]);kind=np.array([w['kind'] for w in W]);gt=np.array([w['gt'] for w in W])
theta={}
for s in sorted(set(seq)):
    m=(seq==s)&(kind=='fit');o=out[m];g=gt[m]
    theta[s]=np.arctan2((o[:,0]*g[:,1]-o[:,1]*g[:,0]).sum(),(o[:,0]*g[:,0]+o[:,1]*g[:,1]).sum())
idx={(w['ev'],w['kind'],w['j']):i for i,w in enumerate(W) if w['kind']=='real'}
def diff(a,b):return abs((a-b+180)%360-180)
errs=[];info=[]
cache={}
for ev,e in enumerate(E):
    s=e['seq']
    if s not in cache:
        acce,gyro,q,pos=load(s);cache[s]=rot_from_q(q,'wxyz')
    R=cache[s][e['s']*4]                      # device -> mundo no instante do play
    yaw0=np.degrees(np.arctan2(R[1,0],R[0,0]))   # direção do eixo X do aparelho (como initializeFrame)
    G=sum(gt[idx[(ev,'real',j)]] for j in range(1,7))
    if np.hypot(*G)<0.8:continue
    gt_dir_tango=np.degrees(np.arctan2(G[1],G[0]));world_dir=gt_dir_tango-np.degrees(theta[s])
    local=world_dir-yaw0               # direção da caminhada no referencial local (yaw do aparelho subtraído); "frente" = +y = 90°
    errs.append(diff(local,90));info.append(local)
e=np.array(errs)
print(f'Hipótese "frente = topo do aparelho" (sem olhar o movimento): {len(e)} inícios reais com >=0,8 m em 3 s')
print(f' erro médio {e.mean():.0f}° | mediana {np.median(e):.0f}° | p90 {np.percentile(e,90):.0f}°')
for t in (15,25,35,60):print(f'  dentro de {t:2d}°: {np.mean(e<=t)*100:3.0f}%')
