#!/bin/sh
set -eu
cd /data
trap 'echo "falhou; consulte docker logs ronin-dataset-download" > train_dataset_1.status' EXIT
if [ ! -f train_dataset_1.zip ]; then
 echo baixando > train_dataset_1.status
 curl -fsSL --retry 20 --retry-all-errors --retry-delay 15 -C - --limit-rate 4M -o train_dataset_1.zip.part 'https://www.frdr-dfdr.ca/repo/files/8/published/publication_538/submitted_data/Data/train_dataset_1.zip'
 test "$(stat -c %s train_dataset_1.zip.part)" = 4818463350
 mv train_dataset_1.zip.part train_dataset_1.zip
fi
echo verificando_e_extraindo > train_dataset_1.status
python /usr/local/bin/extract_ronin.py
sha256sum train_dataset_1.zip > train_dataset_1.sha256
echo concluido > train_dataset_1.status
trap - EXIT
