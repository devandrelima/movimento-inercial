#!/bin/sh
set -eu
for i in $(seq 1 2880); do
  status=$(cat /data/train_dataset_1.status 2>/dev/null || true)
  if [ "$status" = concluido ]; then
    echo analisando > /data/inventory.status
    if python /scripts/inventory_ronin.py; then echo concluido > /data/inventory.status; exit 0; else echo falhou > /data/inventory.status; exit 1; fi
  fi
  sleep 30
done
echo expirou > /data/inventory.status
exit 1
