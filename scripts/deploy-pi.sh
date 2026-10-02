#!/usr/bin/env bash
# Ships the committed code to the Pi and rebuilds the containers.
#
#   pnpm deploy:pi            # host "rpi" from ~/.ssh/config
#   PI_HOST=other pnpm deploy:pi
#
# Only committed files travel (git archive), so a half-edited working copy
# never reaches production. The Pi's own .env is left alone: secrets are set
# there by hand. Everything else lives in the database.
set -euo pipefail

host="${PI_HOST:-rpi}"
dir="${PI_DIR:-gymlog}"
archive="$(mktemp)"
trap 'rm -f "$archive"' EXIT

git archive --format=tar -o "$archive" HEAD
scp -q "$archive" "$host:/tmp/gymlog.tar"

ssh "$host" "set -e
  mkdir -p ~/$dir
  # Unpacked aside first: a failed extract (a full SD card) leaves the running code untouched.
  rm -rf ~/$dir.new && mkdir ~/$dir.new
  tar -xf /tmp/gymlog.tar -C ~/$dir.new
  rm /tmp/gymlog.tar
  cd ~/$dir
  # Code folders are replaced whole, so files deleted in git do not linger.
  rm -rf backend frontend docker scripts docs
  cp -a ~/$dir.new/. ~/$dir/
  rm -rf ~/$dir.new
  if ! test -f .env; then
    cp .env.example .env
    chmod 600 .env
    echo 'New .env from .env.example: set POSTGRES_PASSWORD and JWT_SECRET in ~/$dir/.env, then deploy again.' >&2
    exit 1
  fi
  # The running images tagged, so a bad release can be undone.
  for image in gymlog-api gymlog-web; do
    docker image inspect \$image:latest >/dev/null 2>&1 && docker tag \$image:latest \$image:prev
  done
  docker compose up -d --build
  # The images each build leaves behind would fill the SD card.
  docker image prune -f >/dev/null
  docker ps --filter name=gymlog --format '{{.Names}} {{.Status}}'"

echo "Deployed $(git rev-parse --short HEAD) to $host:~/$dir"
echo "Rollback: on the Pi, docker tag gymlog-api:prev gymlog-api:latest && docker tag gymlog-web:prev gymlog-web:latest && docker compose up -d --no-build"
