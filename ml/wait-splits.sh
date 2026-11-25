#!/bin/sh
set -eu
for i in $(seq 1 2880); do
  if [ "$(cat /data/train_dataset_1.status 2>/dev/null || true)" = concluido ] && [ "$(cat /data/unseen_subjects_test_set.status 2>/dev/null || true)" = concluido ]; then
    echo analisando > /data/split-manifest.status
    if python /scripts/prepare_manifest.py --data-root /data/train_dataset_1 --data-root /data/unseen_subjects_test_set --lists-dir /data/protocol/lists --output /data/split-manifest.json; then echo concluido > /data/split-manifest.status; exit 0; else echo falhou > /data/split-manifest.status; exit 1; fi
  fi
  sleep 30
done
echo expirou > /data/split-manifest.status
exit 1
