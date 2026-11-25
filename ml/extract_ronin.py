import json, os, shutil, stat, zipfile
from pathlib import Path
name=os.environ.get('RONIN_NAME','train_dataset_1')
if name not in {'train_dataset_1','unseen_subjects_test_set'}: raise ValueError('Nome de conjunto não permitido')
archive=Path('/data') / (name+'.zip')
dest=Path('/data') / name
with zipfile.ZipFile(archive) as z:
    items=z.infolist()
    needed=sum(i.file_size for i in items)
    free=shutil.disk_usage('/data').free
    print(f'{len(items)} entradas, {needed} bytes descompactados, {free} bytes livres', flush=True)
    if free < needed + 8 * 1024**3:
        raise RuntimeError('Espaço livre insuficiente para extração com reserva de 8 GiB')
    base=dest.resolve()
    for i in items:
        path=(dest/i.filename).resolve()
        if not path.is_relative_to(base) or stat.S_ISLNK(i.external_attr >> 16):
            raise RuntimeError(f'Entrada insegura: {i.filename!r}')
    dest.mkdir(exist_ok=True)
    for i in items:
        path=dest / i.filename
        if i.is_dir(): path.mkdir(parents=True, exist_ok=True); continue
        path.parent.mkdir(parents=True, exist_ok=True)
        with z.open(i) as src, path.open('wb') as out:
            shutil.copyfileobj(src,out,1024*1024)
    with open(Path('/data') / (name+'.manifest.json'),'w') as f:
        json.dump({'files':len(items),'uncompressed_bytes':needed},f,indent=2)
print('Extração e CRC dos arquivos concluídos',flush=True)
