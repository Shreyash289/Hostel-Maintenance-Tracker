#!/usr/bin/env bash
# Hostel Maintenance Tracker - run everything with plain Podman commands (no compose needed).
#
#   ./podman-run.sh up        build images, create network + volume, start 3 containers
#   ./podman-run.sh status    list containers, images, network, volume
#   ./podman-run.sh logs      last log lines of every container
#   ./podman-run.sh inspect   key details (IP, mounts, ports, health) of every container
#   ./podman-run.sh test      check the app from the host and between containers
#   ./podman-run.sh stop      stop containers (data kept)
#   ./podman-run.sh start     start stopped containers again
#   ./podman-run.sh down      remove containers (network + volume + data kept)
#   ./podman-run.sh push USER push images to docker.io/USER (run "podman login docker.io" first)
#   ./podman-run.sh clean     remove containers, network, volume (ALL DATA) and images
set -euo pipefail
cd "$(dirname "$0")"

VERSION="1.0"
NET="hmt-net"
VOL="hmt-mongo-data"
BACKEND_IMG="localhost/hmt-backend:$VERSION"
FRONTEND_IMG="localhost/hmt-frontend:$VERSION"
MONGO_IMG="docker.io/library/mongo:7"
CONTAINERS=(hmt-frontend hmt-backend hmt-mongo)
JWT_SECRET="${JWT_SECRET:-change-this-hostel-secret}"

say() { printf '\n\033[1;35m==> %s\033[0m\n' "$*"; }

wait_healthy() { # wait_healthy <container> <seconds>
  local c=$1 t=$2 s
  for ((i = 0; i < t; i++)); do
    s=$(podman inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo none)
    [[ $s == healthy ]] && { echo "   $c is healthy"; return 0; }
    sleep 1
  done
  echo "   $c did not become healthy in ${t}s - check: podman logs $c" >&2
  return 1
}

up() {
  say "1. Build custom images from the Containerfiles (tag $VERSION + latest)"
  # --format docker keeps the HEALTHCHECK instruction (the OCI format drops it)
  podman build --format docker -t "$BACKEND_IMG" -t localhost/hmt-backend:latest -f backend/Containerfile backend
  podman build --format docker -t "$FRONTEND_IMG" -t localhost/hmt-frontend:latest -f frontend/Containerfile frontend

  say "2. Create the Podman network and volume (skipped if they already exist)"
  podman network exists "$NET" || podman network create "$NET"
  podman volume exists "$VOL" || podman volume create "$VOL"

  down # replace old containers if this is a re-run (data stays in the volume)

  say "3. Start MongoDB (no published port: only reachable inside $NET)"
  podman run -d --name hmt-mongo --network "$NET" --network-alias mongo \
    -v "$VOL":/data/db \
    --health-cmd "mongosh --quiet --eval \"db.adminCommand('ping')\"" --health-interval 5s \
    --restart unless-stopped \
    "$MONGO_IMG"
  wait_healthy hmt-mongo 60

  say "4. Start the API (port 5000 on the host -> 5000 in the container)"
  podman run -d --name hmt-backend --network "$NET" --network-alias backend \
    -e MONGO_URI=mongodb://mongo:27017/hostel_maintenance -e PORT=5000 -e JWT_SECRET="$JWT_SECRET" \
    -p 5000:5000 --restart unless-stopped \
    "$BACKEND_IMG"
  wait_healthy hmt-backend 60

  say "5. Start the web UI (port 3000 on the host -> 80 in the container)"
  podman run -d --name hmt-frontend --network "$NET" --network-alias frontend \
    -p 3000:80 --restart unless-stopped \
    "$FRONTEND_IMG"
  wait_healthy hmt-frontend 30

  status
  say "Open http://localhost:3000  (warden: admin@hostel.test / admin123, student: riya@hostel.test / student123)"
}

status() {
  say "Containers";  podman ps -a --filter name=hmt- --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
  say "Images";      podman images --filter reference='*hmt-*'
  say "Network";     podman network ls --filter name="$NET"
  say "Volume";      podman volume ls --filter name="$VOL"
}

logs() {
  for c in "${CONTAINERS[@]}"; do say "podman logs --tail 15 $c"; podman logs --tail 15 "$c" || true; done
}

inspect() {
  for c in "${CONTAINERS[@]}"; do
    say "podman inspect $c"
    podman inspect "$c" --format \
'   Image:   {{.ImageName}}
   State:   {{.State.Status}} (health: {{.State.Health.Status}}, restarts: {{.RestartCount}})
   IP:      {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}
   Ports:   {{range $p, $b := .NetworkSettings.Ports}}{{$p}}->{{range $b}}{{.HostPort}}{{end}} {{end}}
   Mounts:  {{range .Mounts}}{{.Name}}{{.Source}} -> {{.Destination}} {{end}}' || true
  done
  say "podman network inspect $NET (subnet + DNS)"
  podman network inspect "$NET" --format '   Subnet: {{range .Subnets}}{{.Subnet}}{{end}}  DNS enabled: {{.DNSEnabled}}'
  say "podman volume inspect $VOL"
  podman volume inspect "$VOL" --format '   Mountpoint on host: {{.Mountpoint}}'
}

test_app() {
  say "From the host, through port mapping"
  curl -fsS http://localhost:5000/api/health && echo
  curl -fsS -o /dev/null -w '   UI http://localhost:3000 -> HTTP %{http_code}\n' http://localhost:3000
  say "Between containers, through the network's DNS (frontend -> backend by name)"
  podman exec hmt-frontend wget -qO- http://backend:5000/api/health && echo
  say "Inside the containers (Linux)"
  podman exec hmt-backend sh -c 'grep PRETTY_NAME /etc/os-release; echo "   user: $(whoami)"; ps'
  podman exec hmt-mongo ls /data/db | head -5
}

stop()  { say "podman stop";  podman stop "${CONTAINERS[@]}"; }
start() { say "podman start"; podman start hmt-mongo hmt-backend hmt-frontend; }
down()  { say "podman rm -f (containers only; volume $VOL keeps the data)"; podman rm -f "${CONTAINERS[@]}" 2>/dev/null || true; }

push() {
  local user=${1:?usage: ./podman-run.sh push <docker-hub-username>}
  for name in hmt-backend hmt-frontend; do
    for tag in "$VERSION" latest; do
      say "push docker.io/$user/$name:$tag"
      podman tag "localhost/$name:$VERSION" "docker.io/$user/$name:$tag"
      podman push "docker.io/$user/$name:$tag"
    done
  done
  say "Done. Public links: https://hub.docker.com/r/$user/hmt-backend  https://hub.docker.com/r/$user/hmt-frontend"
  echo "   Test a pull with: podman pull docker.io/$user/hmt-backend:$VERSION"
}

clean() {
  down
  say "Remove network, volume (ALL DATA) and images"
  podman network rm "$NET" 2>/dev/null || true
  podman volume rm "$VOL" 2>/dev/null || true
  podman rmi -f "$BACKEND_IMG" localhost/hmt-backend:latest "$FRONTEND_IMG" localhost/hmt-frontend:latest 2>/dev/null || true
}

case "${1:-}" in
  up) up ;; status) status ;; logs) logs ;; inspect) inspect ;; test) test_app ;;
  stop) stop ;; start) start ;; down) down ;; push) shift; push "$@" ;; clean) clean ;;
  *) sed -n '2,15p' "$0"; exit 1 ;;
esac
