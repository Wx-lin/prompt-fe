#!/usr/bin/env bash
# Conservative bound for simultaneous release artifacts, backup, Docker load
# and build. All values are bytes on the same filesystem.
set -Eeuo pipefail
backup=${1:?backup bytes required}
runtime=${2:?uncompressed runtime tar bytes required}
source_size=${3:?uncompressed source tar bytes required}
base=${4:?uncompressed base tar bytes required}
upload=${5:?upload bytes required}
available=${6:?available bytes required}
for value in "$backup" "$runtime" "$source_size" "$base" "$upload" "$available"; do
  if ! [[ "$value" =~ ^(0|[1-9][0-9]{0,12})$ ]] || (( value > 1099511627776 )); then
    echo 'Invalid space estimate' >&2
    exit 1
  fi
done
# Two copies of source include expanded source and reconstruction; four runtime
# copies cover extraction, reconstructed public, build context and image layer.
# Two base copies cover image load and extraction; retain 2 GiB spare.
required=$((backup + 4 * runtime + 2 * source_size + 2 * base + upload + 2147483648))
printf 'Disk estimate: required=%s available=%s bytes\n' "$required" "$available"
(( available >= required )) || { echo 'Insufficient space for release peak estimate' >&2; exit 1; }
