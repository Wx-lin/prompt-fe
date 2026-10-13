#!/usr/bin/env bash
set -Eeuo pipefail
release=${1:?release required}
expected=${2:?expected image required}
[[ "$release" =~ ^frontend-[0-9]+-[0-9]+-[0-9]+$ ]]
[[ "$expected" =~ ^sha256:[a-f0-9]{64}$ ]]
cd /opt/aigc-prompt
exec 9>.release-deploy.lock
flock -w 600 9
exec 8>.backend-deploy.lock
flock -w 600 8
incoming="$PWD/releases/$release"
cd "$incoming"
sha256sum -c checksums.txt
[[ $(df --output=avail -B1 /opt/aigc-prompt | tail -1) -ge 2147483648 ]] || { echo 'Less than 2 GiB free; stopped'; exit 1; }
cd /opt/aigc-prompt
sudo -n docker compose config --quiet
container=$(sudo -n docker compose ps -q frontend)
current=$(sudo -n docker inspect --format '{{.Image}}' "$container")
[[ "$current" == "$expected" ]] || { echo 'Concurrent deployment detected'; exit 1; }
reference=$(sudo -n docker inspect --format '{{.Config.Image}}' "$container")
backup="$incoming/backup"
mkdir -m 700 "$backup"
cp -a frontend "$backup/frontend"
sudo -n docker tag "$current" "aigc-frontend:rollback-$release"
switched=false
source_changed=false
restore() {
  status=$?
  trap - EXIT
  set +e
  rollback_failed=false
  if [[ "$status" != 0 && "$source_changed" == true ]]; then
    rsync -a --delete "$backup/frontend/" frontend/ || rollback_failed=true
  fi
  if [[ "$status" != 0 && "$switched" == true ]]; then
    sudo -n docker tag "$current" "$reference" || rollback_failed=true
    sudo -n docker compose up -d --no-deps --no-build frontend || rollback_failed=true
    sudo -n docker compose exec -T gateway nginx -t || rollback_failed=true
    sudo -n docker compose exec -T gateway nginx -s reload || rollback_failed=true
  fi
  if [[ "$rollback_failed" == true ]]; then
    echo 'Rollback incomplete; inspect release backup and container state' >&2
    status=1
  fi
  exit "$status"
}
trap restore EXIT
sudo -n docker load -i "$incoming/image.tar.gz"
candidate="aigc-frontend:$release"
sudo -n docker image inspect "$candidate" >/dev/null
mkdir "$incoming/source"
tar -xzf "$incoming/source.tar.gz" -C "$incoming/source"
# Preserve deployment-only environments and local dependencies.
source_changed=true
rsync -a --delete --exclude='.env*' --exclude='runtime.env' --exclude='node_modules' --exclude='.next' "$incoming/source/" frontend/
[[ $(sudo -n docker inspect --format '{{.Image}}' "$(sudo -n docker compose ps -q frontend)") == "$expected" ]] || { echo 'Concurrent deployment detected'; exit 1; }
switched=true
sudo -n docker tag "$candidate" "$reference"
sudo -n docker compose up -d --no-deps --no-build frontend
[[ $(sudo -n docker inspect --format '{{.Image}}' "$(sudo -n docker compose ps -q frontend)") == "$(sudo -n docker image inspect --format '{{.Id}}' "$candidate")" ]]
sudo -n docker compose exec -T gateway nginx -t
sudo -n docker compose exec -T gateway nginx -s reload
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --max-time 10 https://aigc-prompt.com/ -o "$incoming/home.html" && test -s "$incoming/home.html"; then
    echo "Frontend deployed: $release"
    exit 0
  fi
  sleep 2
done
echo 'Frontend health check failed; rolling back'
exit 1
