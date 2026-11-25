#!/bin/sh
set -eu
cd /data
name=unseen_subjects_test_set
trap 'echo "falhou; consulte docker logs ronin-test-unseen" > unseen_subjects_test_set.status' EXIT
if [ ! -f "$name.zip" ]; then
  echo baixando > "$name.status"
  curl -fsSL --retry 20 --retry-all-errors --retry-delay 15 -C - --limit-rate 4M -o "$name.zip.part" 'https://www.frdr-dfdr.ca/repo/files/8/published/publication_538/submitted_data/Data/unseen_subjects_test_set.zip'
  test "$(stat -c %s "$name.zip.part")" = 3211376453
  mv "$name.zip.part" "$name.zip"
fi
echo verificando_e_extraindo > "$name.status"
RONIN_NAME="$name" python /scripts/extract_ronin.py
sha256sum "$name.zip" > "$name.sha256"
echo concluido > "$name.status"
trap - EXIT
