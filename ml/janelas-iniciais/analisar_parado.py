import json,numpy as np
d=json.load(open('/w/windows.json'));out=np.array(json.load(open('/w/outputs.json')))
W=d['windows'];E=d['events']
gt=np.array([w['gt'] for w in W]);seq=np.array([w['seq'] for w in W]);kind=np.array([w['kind'] for w in W])
# rotação por sequência: gt ≈ R(theta) · saída (janelas normais de ajuste)
theta={}
for s in sorted(set(seq)):
    m=(seq==s)&(kind=='fit');o=out[m];g=gt[m]
    theta[s]=np.arctan2((o[:,0]*g[:,1]-o[:,1]*g[:,0]).sum(),(o[:,0]*g[:,0]+o[:,1]*g[:,1]).sum())
def rot(o,s):
    c,sn=np.cos(theta[s]),np.sin(theta[s]);return np.array([c*o[0]-sn*o[1],sn*o[0]+c*o[1]])
fit=np.array([np.linalg.norm(rot(out[i],seq[i])-gt[i]) for i in range(len(W)) if kind[i]=='fit'])
mae=np.mean([np.abs(rot(out[i],seq[i])-gt[i]) for i in range(len(W)) if kind[i]=='fit'])
print(f'SANIDADE (janelas normais, {len(fit)}): erro médio |Δ| por janela de 0,5 s = {fit.mean():.3f} m | MAE por componente = {mae:.3f} m (entrega relata 0,074)')
print('theta por sequência (graus):',{k:round(float(np.degrees(v)),0) for k,v in list(theta.items())[:6]},'...')
idx={}
for i,w in enumerate(W):
    if w['kind'] in('pad','real'):idx[(w['ev'],w['kind'],w['j'])]=i
def o(ev,k,j):
    i=idx[(ev,k,j)];return rot(out[i],E[ev]['seq']),gt[i]
print('\nJanelas iniciais (play apertado com o aparelho parado; 57 eventos reais)')
print(' j  tempo após play | |preenchido − histórico real|  | erro vs referência: preenchido  histórico real  | deslocamento real médio')
for j in (1,2,3):
    diff=[];ep=[];er=[];mag=[]
    for ev in range(len(E)):
        p,g=o(ev,'pad',j);r,_=o(ev,'real',j)
        diff.append(np.linalg.norm(p-r));ep.append(np.linalg.norm(p-g));er.append(np.linalg.norm(r-g));mag.append(np.linalg.norm(g))
    print(f' {j}  {0.5*j:.1f} s           | média {np.mean(diff):.3f} m (p90 {np.percentile(diff,90):.3f})        | {np.mean(ep):.3f} m            {np.mean(er):.3f} m          | {np.mean(mag):.2f} m')
# posição acumulada nos primeiros 3 s (j=1..6)
print('\nPosição estimada aos 3 s (soma de 6 saídas de 0,5 s) contra a referência — erro final em metros')
cur=[];pad=[];real=[];gtn=[]
for ev in range(len(E)):
    G=sum(o(ev,'real',j)[1] for j in range(1,7));gtn.append(np.linalg.norm(G))
    R=sum(o(ev,'real',j)[0] for j in range(1,7))
    P=sum(o(ev,'pad',j)[0] if j<4 else o(ev,'real',j)[0] for j in range(1,7))
    C=sum(o(ev,'real',j)[0] for j in range(4,7))      # comportamento atual: as 3 primeiras saídas não existem
    real.append(np.linalg.norm(R-G));pad.append(np.linalg.norm(P-G));cur.append(np.linalg.norm(C-G))
print(f' distância real percorrida em 3 s: média {np.mean(gtn):.2f} m')
print(f' atual (sem as 3 primeiras saídas):      erro final médio {np.mean(cur):.2f} m (mediana {np.median(cur):.2f})')
print(f' com janelas preenchidas (proposta):     erro final médio {np.mean(pad):.2f} m (mediana {np.median(pad):.2f})')
print(f' ideal (histórico real, referência):      erro final médio {np.mean(real):.2f} m (mediana {np.median(real):.2f})')
