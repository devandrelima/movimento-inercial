import bisect, collections, csv, json
from pathlib import Path
import h5py
import numpy as np

root=Path('/data/train_dataset_1')
files=sorted(root.rglob('data.hdf5'))
if not files: raise RuntimeError('Nenhum HDF5 encontrado')
summary={'trajectories':len(files),'variables':{},'frequency_hz':{},'sequences':[],'phone':{}}
variables=collections.Counter(); rates=[]
for file in files:
    with h5py.File(file,'r') as f:
        fields=[]
        for group in ('synced','pose'):
            if group in f:
                fields.extend(group+'/'+k for k in f[group].keys())
        variables.update(fields)
        t=np.asarray(f['synced/time']); dt=np.diff(t); valid=dt[dt>0]
        if not len(valid): raise ValueError(f'{file}: timestamps inválidos')
        rate=float(1/np.median(valid)); rates.append(rate)
        summary['sequences'].append({'name':str(file.relative_to(root)), 'samples':int(len(t)), 'duration_s':float(t[-1]-t[0]),'median_hz':rate, 'non_increasing':int(np.sum(dt<=0))})
summary['variables']=dict(sorted(variables.items()))
summary['frequency_hz']={'min':min(rates),'median':float(np.median(rates)),'max':max(rates)}
with open('/phone.csv',encoding='utf-8-sig',newline='') as f:
    rows=list(csv.DictReader(f))
counts=collections.Counter(row['tipo'] for row in rows)
phone={}
for typ in ('devicemotion','gyroscope','deviceorientation'):
    group=[row for row in rows if row['tipo']==typ]
    times=[float(row['tempo_monotonico_ms']) for row in group if row.get('tempo_monotonico_ms')]
    phone[typ]={'count':len(group),'event_hz':(len(times)-1)*1000/(times[-1]-times[0]) if len(times)>1 and times[-1]>times[0] else None}
motion=[row for row in rows if row['tipo']=='devicemotion' and all(row.get(k) for k in ('rot_alpha_graus_s','rot_beta_graus_s','rot_gamma_graus_s'))]
gyro=[row for row in rows if row['tipo']=='gyroscope' and all(row.get(k) for k in ('gyro_x_rad_s','gyro_y_rad_s','gyro_z_rad_s'))]
gyro.sort(key=lambda row:float(row['tempo_monotonico_ms']))
times=[float(row['tempo_monotonico_ms']) for row in gyro]; pairs=[]
for row in motion:
    t=float(row['tempo_monotonico_ms']); i=bisect.bisect_left(times,t); indices=[j for j in (i-1,i) if 0<=j<len(times)]
    if not indices: continue
    closest=min(indices,key=lambda j:abs(times[j]-t))
    if abs(times[closest]-t)<=10: pairs.append((row,gyro[closest]))
correlations={}
if len(pairs)>1:
    for event_axis, sensor_axis in zip(('rot_alpha_graus_s','rot_beta_graus_s','rot_gamma_graus_s'),('gyro_x_rad_s','gyro_y_rad_s','gyro_z_rad_s')):
        a=np.array([float(x[event_axis])*np.pi/180 for x,y in pairs]);b=np.array([float(y[sensor_axis]) for x,y in pairs])
        correlations[event_axis+'__'+sensor_axis]=float(np.corrcoef(a,b)[0,1]) if np.std(a)>0 and np.std(b)>0 else None
summary['phone_axis_comparison']={'method':'vizinho mais próximo até 10 ms; graus/s convertidos em rad/s','matched_pairs':len(pairs),'correlations':correlations}
summary['phone']={'event_counts':dict(counts),'rates':phone,'orientation_absolute':dict(collections.Counter(row.get('orient_absoluta','') for row in rows if row['tipo']=='deviceorientation'))}
out=Path('/data/comparacao-inventario.json'); tmp=out.with_suffix('.tmp')
tmp.write_text(json.dumps(summary,indent=2,ensure_ascii=False));tmp.replace(out)
print(f'Inventário concluído: {len(files)} trajetórias; resultado em {out}',flush=True)
