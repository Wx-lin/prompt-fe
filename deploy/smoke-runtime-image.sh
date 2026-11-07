#!/usr/bin/env bash
# CI-only real Engine / BuildKit smoke. No remote services or production data.
set -Eeuo pipefail
: "${GITHUB_SHA:?}" "${GITHUB_RUN_ID:?}" "${GITHUB_RUN_ATTEMPT:?}"
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ && "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]]
source deploy/runtime-base.env
work=$(mktemp -d)
container="aigc-frontend-smoke-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
candidate="aigc-frontend:frontend-1-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
container_started=false
cleanup() { if [[ "$container_started" == true ]]; then sudo -n docker rm -f "$container" >/dev/null 2>&1 || true; fi; }
trap cleanup EXIT
mkdir -p "$work/runtime/app/.next"
cp -a .next/standalone/. "$work/runtime/app/"
cp -a .next/static "$work/runtime/app/.next/static"
test ! -e "$work/runtime/app/public"
git archive "$GITHUB_SHA" -- public ':(exclude)public/character-library' ':(exclude)public/character-outfits' ':(exclude)public/character-visuals' ':(exclude)public/character-demo' | tar -xf - -C "$work/runtime/app/"
test -f "$work/runtime/app/server.js"
sudo -n docker pull --platform linux/amd64 "$AIGC_RUNTIME_BASE_REF"
[[ $(sudo -n docker image inspect --format '{{.Id}} {{.Os}} {{.Architecture}}' "$AIGC_RUNTIME_BASE_REF") == "$AIGC_RUNTIME_BASE_ID linux amd64" ]]
sudo -n docker save "$AIGC_RUNTIME_BASE_ID" | gzip -1 > "$work/base-image.raw.tar.gz"
python3 deploy/validate-runtime-base.py "$work/base-image.raw.tar.gz" "$AIGC_RUNTIME_BASE_ID" "$work/base-image.tar.gz"
python3 deploy/validate-runtime-base.py "$work/base-image.tar.gz" "$AIGC_RUNTIME_BASE_ID"
# This job runs on a fresh GitHub-hosted runner. Remove only the exact base
# reference just pulled, then require the image ID to be absent so the helper
# exercises its real first-import path instead of reusing an existing image.
sudo -n docker image rm "$AIGC_RUNTIME_BASE_REF"
if sudo -n docker image inspect "$AIGC_RUNTIME_BASE_ID" >/dev/null 2>&1; then
  echo 'Base image still exists; first-import smoke cannot be verified' >&2
  exit 1
fi
bash deploy/build-runtime-image.sh "$work" "$candidate" "$GITHUB_SHA" "$AIGC_RUNTIME_BASE_ID"
# Explicitly exercise BuildKit as well as the unchanged server sudo command.
sudo -n env DOCKER_BUILDKIT=1 docker build --pull=false --network=none -t "$candidate" "$work/runtime"
sudo -n docker run --rm --network=none --entrypoint node "$candidate" -e 'require("sharp")({create:{width:2,height:2,channels:3,background:"red"}}).png().toBuffer().then(b=>{if(!b.length)process.exit(1)}).catch(e=>{console.error(e);process.exit(1)})'
sudo -n docker run -d --name "$container" --network none -e API_BASE_URL=http://127.0.0.1:18080 --entrypoint sh "$candidate" -c 'node -e '\''require("http").createServer((req,res)=>{res.writeHead(200,{"Content-Type":"application/json"});res.end("{}")}).listen(18080,"127.0.0.1")'\'' & exec node server.js' >/dev/null
container_started=true
for attempt in $(seq 1 30); do
  if sudo -n docker exec "$container" node -e 'Promise.all([fetch("http://127.0.0.1:3000/").then(async r=>r.status===200&&(await r.text()).length>1000),fetch("http://127.0.0.1:3000/api/auth/send-code",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:"test@example.com"})}).then(r=>r.status===204)]).then(v=>process.exit(v.every(Boolean)?0:1)).catch(()=>process.exit(1))'; then
    echo 'Docker BuildKit runtime smoke passed'
    exit 0
  fi
  sleep 2
done
sudo -n docker logs "$container" >&2 || true
exit 1
