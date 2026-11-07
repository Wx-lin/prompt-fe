#!/usr/bin/env bash
set -Eeuo pipefail
incoming=${1:?release directory required}
candidate=${2:?candidate image required}
revision=${3:?revision required}
base_id=${4:?pinned base image ID required}
[[ "$candidate" =~ ^aigc-frontend:frontend-[0-9]+-[0-9]+-[0-9]+$ ]]
[[ "$revision" =~ ^[a-f0-9]{40}$ ]]
[[ "$base_id" =~ ^sha256:[a-f0-9]{64}$ ]]
test -d "$incoming/runtime"

# Reuse only the exact local content-addressed base; do not upload another
# archive on every deployment. Missing images require verified offline transport.
if [[ $(sudo -n docker image inspect --format '{{.Id}}' "$base_id" 2>/dev/null || true) != "$base_id" ]]; then
# Validate the entire untagged Docker save archive against the pinned config ID
# and its own content-addressed uncompressed layer hashes before docker load.
python3 "$(dirname "$0")/validate-runtime-base.py" "$incoming/base-image.tar.gz" "$base_id"

sudo -n docker load --input "$incoming/base-image.tar.gz"
fi
[[ $(sudo -n docker image inspect --format '{{.Id}}' "$base_id") == "$base_id" ]]
runtime=$(sudo -n docker run --rm --network=none --entrypoint node "$base_id" -p \
  '(()=>{const n=require("fs").readFileSync("/etc/passwd","utf8").split("\n").find(x=>x.startsWith("node:"));const p=n.split(":");return [process.version,process.arch,p[2],p[3]].join(" ")})()')
[[ "$runtime" == 'v24.21.0 x64 1000 1000' ]] || { echo 'Unexpected Node runtime or user identity' >&2; exit 1; }
# Keep a project-scoped base tag so Docker retains its image metadata and the
# next deployment can reuse it. Never replace a conflicting tag.
base_tag="aigc-frontend-base:node-24-21-${base_id:7:12}"
existing=$(sudo -n docker image inspect --format '{{.Id}}' "$base_tag" 2>/dev/null || true)
if [[ -n "$existing" && "$existing" != "$base_id" ]]; then
  echo 'Base image tag belongs to a different image' >&2
  exit 1
fi
if [[ -z "$existing" ]]; then
  sudo -n docker tag "$base_id" "$base_tag"
fi
[[ $(sudo -n docker image inspect --format '{{.Id}}' "$base_tag") == "$base_id" ]]
cat > "$incoming/runtime/Dockerfile" <<DOCKERFILE
FROM $base_tag
COPY --chown=node:node app/ /app/
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 AIGC_DEMO_MODE=false
LABEL org.opencontainers.image.revision="$revision"
USER node
EXPOSE 3000
CMD ["node", "server.js"]
DOCKERFILE
sudo -n docker build --pull=false --network=none -t "$candidate" "$incoming/runtime" > "$incoming/build.log" 2>&1 || {
  tail -40 "$incoming/build.log"
  exit 1
}
