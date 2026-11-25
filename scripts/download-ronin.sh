#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/ronin
status=data/ronin/train_dataset_1.status
trap 'printf "falhou: download ou validação; consulte download.log\n" > "$status"' ERR
printf 'baixando\n' > "$status"
curl -fsSL --retry 6 --retry-delay 10 --continue-at - --limit-rate 8M --output data/ronin/train_dataset_1.zip.part 'https://www.frdr-dfdr.ca/repo/files/8/published/publication_538/submitted_data/Data/train_dataset_1.zip'
[ "$(stat -c %s data/ronin/train_dataset_1.zip.part)" = 4818463350 ]
printf 'verificando ZIP\n' > "$status"
unzip -tq data/ronin/train_dataset_1.zip.part
mv data/ronin/train_dataset_1.zip.part data/ronin/train_dataset_1.zip
sha256sum data/ronin/train_dataset_1.zip > data/ronin/train_dataset_1.sha256
printf 'concluído e validado\n' > "$status"
