import json, sys
import h5py
import numpy as np

path = sys.argv[1]
summary = {'path': path, 'datasets': {}}
with h5py.File(path, 'r') as f:
    def collect(name, obj):
        if isinstance(obj, h5py.Dataset):
            summary['datasets'][name] = {'shape': list(obj.shape), 'dtype': str(obj.dtype), 'attrs': {k: str(v) for k,v in obj.attrs.items()}}
    f.visititems(collect)
    t = np.asarray(f['synced/time'])
    dt = np.diff(t)
    if len(dt):
        summary['time'] = {'samples': len(t), 'start': float(t[0]), 'end': float(t[-1]), 'interval_median_s': float(np.median(dt)), 'frequency_median_hz': float(1/np.median(dt)), 'non_increasing': int(np.sum(dt <= 0))}
    for key in ['synced/acce', 'synced/gyro', 'synced/gyro_uncalib', 'synced/game_rv', 'pose/tango_pos']:
        if key in f:
            a = np.asarray(f[key]); summary['datasets'][key]['sample_stats'] = {'min':np.min(a,axis=0).tolist(), 'max':np.max(a,axis=0).tolist(), 'median':np.median(a,axis=0).tolist()}
print(json.dumps(summary,indent=2,allow_nan=False))
