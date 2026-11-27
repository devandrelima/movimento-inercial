import json,numpy as np
d=json.load(open('/w/walking.json'));out=np.array(json.load(open('/w/outputs_walking.json')))
W=d['windows'];info=d['info']
# rotação por sequência vinda da análise anterior (recalculada com as janelas de ajuste)
d1=json.load(open('/w/windows.json'));o1=np.array(json.load(open('/w/outputs.json')))
seq1=np.array([w['seq'] for w in d1['windows']]);k1=np.array([w['kind'] for w in d1['windows']]);g1=np.array([w['gt'] for w in d1['windows']])
theta={}
for s in sorted(set(seq1)):
    m=(seq1==s)&(k1=='fit');o=o1[m];g=g1[m]
    theta[s]=np.arctan2((o[:,0]*g[:,1]-o[:,1]*g[:,0]).sum(),(o[:,0]*g[:,0]+o[:,1]*g[:,1]).sum())
def rot(v,s):
    c,sn=np.cos(theta[s]),np.sin(theta[s]);return np.array([c*v[0]-sn*v[1],sn*v[0]+c*v[1]])
res={}
for i,w in enumerate(W):res[(w['ev'],w['kind'],w['j'])]=(rot(out[i],w['seq']),np.array(w['gt']))
print('CASO RUIM: play apertado já andando (preenchimento com cópia de uma amostra em movimento)')
for j in (1,2,3):
    diff=[];ep=[];er=[]
    for ev in {k[0] for k in res}:
        p,g=res[(ev,'pad',j)];r,_=res[(ev,'real',j)]
        diff.append(np.linalg.norm(p-r));ep.append(np.linalg.norm(p-g));er.append(np.linalg.norm(r-g))
    print(f' j={j} ({0.5*j:.1f} s): |preenchido−real| média {np.mean(diff):.3f} m | erro vs referência: preenchido {np.mean(ep):.3f} m, histórico real {np.mean(er):.3f} m  ({len(diff)} casos)')
# detector: 10 amostras (0,2 s) — desvio-padrão de |aceleração| e |giro| médio
for cls in ('parado','andando'):
    a=np.array([i['acc_std'] for i in info if i['cls']==cls]);g=np.array([i['gyro'] for i in info if i['cls']==cls])
    print(f'\\n{cls}: desvio de |acc| p50 {np.percentile(a,50):.3f} p95 {np.percentile(a,95):.3f} p99 {np.percentile(a,99):.3f} máx {a.max():.3f} | |giro| médio p50 {np.percentile(g,50):.3f} p95 {np.percentile(g,95):.3f} máx {g.max():.3f}')
for thr_a,thr_g in ((0.3,0.25),(0.4,0.3),(0.5,0.4),(0.6,0.5)):
    cl={c:[(i['acc_std']<thr_a and i['gyro']<thr_g) for i in info if i['cls']==c] for c in ('parado','andando')}
    print(f'limiar acc_std<{thr_a}, giro<{thr_g}: aceita {np.mean(cl["parado"])*100:.0f}% dos casos parados e {np.mean(cl["andando"])*100:.1f}% dos casos andando')
