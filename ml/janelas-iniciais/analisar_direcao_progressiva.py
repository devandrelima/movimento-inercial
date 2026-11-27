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

def old_chords(P):
    """esquema atual: âncora provisória = 1º ponto >= 0,25 m; final = 1º ponto >= 0,75 m. devolve a direção da corda a cada atualização"""
    res=[]
    for n in range(2,len(P)+1):
        sub=P[:n];k=first(sub,0.75)
        if k is None:k=first(sub,0.25)
        res.append(None if k is None else ang(sub[k]))
    return res
def new_chords(P,final=1.0,prov=0.25):
    """proposta: até 'final' metros a âncora é o ponto mais distante; depois congela no 1º ponto >= final"""
    res=[]
    for n in range(2,len(P)+1):
        sub=P[:n];k=first(sub,final)
        if k is None:
            dist=np.hypot(sub[:,0],sub[:,1]);k=int(dist.argmax())
            if dist[k]<prov:k=None
        res.append(None if k is None else ang(sub[k]))
    return res
def stats(fn,label):
    steps=[];finalerr=[];maxjump=[]
    for ev in range(len(E)):
        P,G=path(ev,True);ch=fn(P);seq_=[c for c in ch if c is not None]
        if len(seq_)<2:continue
        d=[diff(seq_[i],seq_[i-1]) for i in range(1,len(seq_))];steps+=d;maxjump.append(max(d))
        kG=first(G,0.25)  # erro da direção final contra a real
        if kG is not None:finalerr.append(diff(seq_[-1],ang(G[min(len(G)-1,kG+3)])))
    steps=np.array(steps);maxjump=np.array(maxjump)
    print(f' {label:34s} giro do desenho por atualização: média {steps.mean():4.1f}° p90 {np.percentile(steps,90):4.1f}° | maior giro único por evento: média {maxjump.mean():4.1f}° p90 {np.percentile(maxjump,90):4.1f}° (>20°: {np.mean(maxjump>20)*100:.0f}%)')
stats(old_chords,'atual (provisória 25 cm → final 75 cm)')
stats(lambda P:new_chords(P,1.0),'progressiva (ponta atual, final 1 m)')
stats(lambda P:new_chords(P,0.75),'progressiva (ponta atual, final 75 cm)')
