"""Inventory RoNIN official splits without loading sensor arrays.

The output identifies missing inputs explicitly; it does not start training.
"""
import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

SPLITS = {'train': 'list_train.txt', 'validation': 'list_val.txt', 'test_unseen': 'list_test_unseen.txt'}


def prepare_manifest(data_roots: list[Path], lists_dir: Path) -> dict:
    found: dict[str, Path] = {}
    for root in data_roots:
        if not root.is_dir():
            continue
        for path in root.rglob('data.hdf5'):
            name = path.parent.name
            if name in found:
                raise ValueError(f'Sequência duplicada em raízes diferentes: {name}')
            if not (path.parent / 'info.json').is_file():
                raise ValueError(f'Falta info.json: {path.parent}')
            found[name] = path.parent.resolve()
    splits = {}
    membership: dict[str, str] = {}
    for split, filename in SPLITS.items():
        path = lists_dir / filename
        content = path.read_bytes()
        names = [line.split()[0] for line in content.decode('utf-8').splitlines() if line.strip() and not line.lstrip().startswith('#')]
        if len(names) != len(set(names)):
            raise ValueError(f'Nomes repetidos na lista {filename}')
        for name in names:
            if name in membership:
                raise ValueError(f'Sequência {name} aparece em {membership[name]} e {split}')
            membership[name] = split
        present = sorted(name for name in names if name in found)
        missing = sorted(name for name in names if name not in found)
        splits[split] = {'source':filename,'list_sha256':hashlib.sha256(content).hexdigest(),'expected':len(names),'available':len(present),'missing':missing,'sequences':[{'id':name,'path':str(found[name])} for name in present]}
    groups: dict[str, set[str]] = defaultdict(set)
    for name, split in membership.items():
        groups[name.split('_', 1)[0]].add(split)
    candidate_leaks = sorted(group for group, labels in groups.items() if 'test_unseen' in labels and len(labels) > 1)
    if candidate_leaks:
        raise ValueError('Possível sobreposição de prefixos no teste não visto: ' + ', '.join(candidate_leaks))
    unlisted = sorted(set(found) - set(membership))
    return {'description':'Inventário de listas oficiais; prefixos são verificação conservadora, não prova de identidade.', 'splits':splits, 'unlisted':unlisted, 'ready_for_full_protocol':all(not item['missing'] for item in splits.values()) and not unlisted}


def main() -> None:
    parser=argparse.ArgumentParser()
    parser.add_argument('--data-root', type=Path, action='append', required=True)
    parser.add_argument('--lists-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args=parser.parse_args()
    result=prepare_manifest(args.data_root,args.lists_dir)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    for name, split in result['splits'].items():
        print(f"{name}: {split['available']}/{split['expected']} disponíveis; faltam {len(split['missing'])}")
    print('Protocolo completo disponível:', 'sim' if result['ready_for_full_protocol'] else 'não')

if __name__ == '__main__':
    main()
