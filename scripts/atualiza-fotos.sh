#!/usr/bin/env bash
# Atualiza a galeria de fotos do site DeMolay.
#
# O que faz:
#   1. Pega as imagens de uma pasta de origem (padrão: /tmp/fotos-id)
#   2. Adiciona em public/fotos APENAS as que ainda não existem (compara por
#      conteúdo/md5 — não duplica) renomeando na sequência foto-N.jpg
#   3. Converte PNG/HEIC para JPG
#   4. Builda o site e publica na branch gh-pages
#
# Uso:
#   GH_TOKEN=ghp_xxx ./scripts/atualiza-fotos.sh [pasta-de-origem]
#
# A galeria lê a pasta public/fotos automaticamente (não precisa editar código).

set -euo pipefail

ORIGEM="${1:-/tmp/fotos-id}"
PROJ="/Users/vecchi/Documents/DeMolay/Sites"
FOTOS="$PROJ/public/fotos"
REPO="github.com/roquedinizarruda307/roquedinizarruda307.github.io.git"
: "${GH_TOKEN:?Defina GH_TOKEN com o Personal Access Token da conta roquedinizarruda307}"

cd "$PROJ"

echo "==> Indexando fotos já existentes (md5)…"
declare -A existentes
while IFS= read -r h; do existentes["$h"]=1; done < <(
  find "$FOTOS" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.png' \) -exec md5 -q {} \;
)

# próximo número da sequência foto-N
prox=$(ls "$FOTOS" 2>/dev/null | grep -oE 'foto-[0-9]+' | grep -oE '[0-9]+' | sort -n | tail -1)
prox=$(( ${prox:-0} + 1 ))

echo "==> Adicionando fotos novas a partir de foto-$prox …"
novas=0
while IFS= read -r -d '' f; do
  h=$(md5 -q "$f")
  [ -n "${existentes[$h]:-}" ] && continue           # já existe (mesmo conteúdo) → pula
  dest="$FOTOS/foto-$prox.jpg"
  # converte para jpg (sips lida com png/heic/jpg)
  sips -s format jpeg "$f" --out "$dest" >/dev/null 2>&1 || cp "$f" "$dest"
  # miniatura leve para a grade da galeria
  mkdir -p "$FOTOS/thumbs"
  sips -Z 500 -s format jpeg -s formatOptions 55 "$dest" --out "$FOTOS/thumbs/$(basename "$dest")" >/dev/null 2>&1
  existentes["$h"]=1
  prox=$((prox+1)); novas=$((novas+1))
done < <(find "$ORIGEM" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \) -print0 | sort -z)

echo "==> $novas foto(s) nova(s) adicionada(s). Total no site: $(ls "$FOTOS"/*.jpg | wc -l | tr -d ' ')"
if [ "$novas" -eq 0 ]; then echo "Nada novo. Saindo."; exit 0; fi

echo "==> Buildando…"
rm -rf out && npm run build >/dev/null 2>&1 && touch out/.nojekyll

echo "==> Publicando na gh-pages…"
rm -rf /tmp/ghdeploy && cp -R out /tmp/ghdeploy
cd /tmp/ghdeploy
git init -q && git checkout -q -b gh-pages && git add -A
git -c user.name="rda307" -c user.email="rda307@users.noreply.github.com" commit -qm "Deploy: +$novas fotos"
git push -fq "https://roquedinizarruda307:${GH_TOKEN}@${REPO}" gh-pages

echo "==> Commit das fotos na main…"
cd "$PROJ"
git add public/fotos
git -c user.name="rda307" -c user.email="rda307@users.noreply.github.com" commit -qm "Adiciona $novas fotos à galeria" || true
git push -q "https://roquedinizarruda307:${GH_TOKEN}@${REPO}" main || true

echo "==> Pronto! $novas fotos novas no ar."
