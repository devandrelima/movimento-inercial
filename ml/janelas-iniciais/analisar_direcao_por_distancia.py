import json,numpy as np
d=json.load(open('/w/windows.json'));out=np.array(json.load(open('/w/outputs.json')))
W=d['windows'];E=d['events']
seq=np.array([w['seq'] for w in W]);kind=np.array([w['kind'] for w in W]);gt=np.array([w['gt'] for w in W])
theta={}
for s in sorted(set(seq)):
    m=(seq==s)&(kind=='fit');o=out[m];g=gt[m]
    theta[s]=np.arctan2((o[:,0]*g[:,1]-o[:,1]*g[:,0]).sum(),(o[:,0]*g[:,0]+o[:,1]*g[:,1]).sum())
def rot(v,s):
    c,sn=np.cos(theta[s]),np.sin(theta[s]);return np.array([c*v[0]-sn*v[1],sn*v[0]+c*v[1]])
idx={(w['ev'],w['kind'],w['j']):i for i,w in enumerate(W) if w['kind'] in('pad','real')}
def ang(v):return np.degrees(np.arctan2(v[1],v[0]))
def diff(a,b):return abs((a-b+180)%360-180)
def path(ev,pad_early,n=6):
    P=[np.zeros(2)];G=[np.zeros(2)]
    for j in range(1,n+1):
        k='pad' if (pad_early and j<4) else 'real'
        i=idx[(ev,k,j)];P.append(P[-1]+rot(out[i],E[ev]['seq']));G.append(G[-1]+gt[i])
    return np.array(P),np.array(G)
def first(P,limit):
    for k in range(1,len(P)):
        if np.hypot(*P[k])>=limit:return k
    return None

# mais pontos: usa até 8 saídas (4 s) para alcançar 1-1,5 m: precisa das janelas 7-8, que não existem; limita a 6 (3 s)
print('Erro de direção (graus) por distância da âncora, só eventos que alcançam a distância em 3 s')
for limit in (0.25,0.4,0.5,0.75,1.0,1.25,1.5):
    errs=[];when=[]
    for ev in range(len(E)):
        P,G=path(ev,True);k=first(P,limit)
        if k is None or np.hypot(*G[k])<0.15:continue
        errs.append(diff(ang(P[k]),ang(G[k])));when.append(k*0.5)
    e=np.array(errs)
    if len(e)<8:print(f' {limit:4.2f} m: só {len(e)} eventos alcançam');continue
    print(f' {limit:4.2f} m: n={len(e):2d} | erro médio {e.mean():5.1f}° | mediana {np.median(e):5.1f}° | p90 {np.percentile(e,90):5.1f}° | >30°: {np.mean(e>30)*100:3.0f}% | ~{np.mean(when):.1f}s após o play')
# direção por regressão: soma dos deslocamentos até a distância L (equivale à corda), e por média ponderada dos 3 últimos trechos
print('\nEstimativa pela corda até o ponto MAIS DISTANTE dentro de L (em vez do primeiro que passa de L):')
for L in (0.75,1.0):
    errs=[]
    for ev in range(len(E)):
        P,G=path(ev,True)
        k=first(P,L)
        if k is None or np.hypot(*G[k])<0.15:continue
        errs.append(diff(ang(P[min(k+1,len(P)-1)]),ang(G[min(k+1,len(G)-1)])))
    e=np.array(errs);print(f' L={L}: n={len(e)} erro médio {e.mean():.1f}° mediana {np.median(e):.1f}°')
