# 🛠️ Hostel Maintenance Tracker (MERN + Podman)

**21CSE216P Linux and Container Technologies: Capstone Project**

Tracks hostel room maintenance complaints, with **student and warden (admin) logins**.
Built with **MongoDB, Express, React (Vite) and Node.js**, containerized with **Podman** using custom **Containerfiles**, a **Podman network**, a **Podman volume** and **port mapping**.
All rooms and students are **fictional**.

```
                    host port 3000                      host port 5000
Browser ──────────► [hmt-frontend]  ──── /api/ ────►  [hmt-backend]  ──────►  [hmt-mongo]
                    nginx:alpine                       node:20-alpine          mongo:7
                    custom image                       custom image            no host port
                    hmt-frontend:1.0                   hmt-backend:1.0               │
                 └────────────────────── Podman network: hmt-net ───────────────────┘
                                                                          Podman volume: hmt-mongo-data
                                                                          mounted at /data/db
```

---

## Capstone checklist

| Guideline | Where in this repo |
|---|---|
| Small working application | `backend/` (Express API) + `frontend/` (React UI) |
| Custom **Containerfile** | [`backend/Containerfile`](backend/Containerfile), [`frontend/Containerfile`](frontend/Containerfile) (multi-stage) |
| Custom **Podman image** | `localhost/hmt-backend:1.0`, `localhost/hmt-frontend:1.0`, built by `podman build` |
| At least one running container | 3 containers: `hmt-mongo`, `hmt-backend`, `hmt-frontend` |
| **Podman network** | `hmt-net` (user-defined bridge with DNS): `podman network create hmt-net` |
| **Persistent storage** | Podman volume `hmt-mongo-data` → `/data/db` |
| **Port mapping** | `-p 3000:80` (UI), `-p 5000:5000` (API). MongoDB is not published |
| Container management & troubleshooting | [`podman-run.sh`](podman-run.sh): `up / status / logs / inspect / test / stop / start / down / clean` + [Troubleshooting](#troubleshooting) |
| Image versioning + registry push/pull | Tags `1.0` and `latest`; `./podman-run.sh push <user>` → Docker Hub |
| README with commands | This file |

---

## Prerequisites

- **Podman 4+**. On Windows or macOS, install [Podman Desktop](https://podman-desktop.io) (it sets up the Podman machine, a small Linux VM). On Linux: `sudo dnf install podman` or `sudo apt install podman`.
- Windows: run the commands in **Git Bash** or **WSL**. The `podman` commands also work in PowerShell.

```bash
podman machine init
```
```bash
podman machine start
```
```bash
podman info
```
The first two commands are only for Windows and macOS. `podman info` checks that Podman is working.

---

## Option A: one script (recommended for the demo)

```bash
chmod +x podman-run.sh
```
```bash
./podman-run.sh up
```
This builds the images, creates the network and volume, and starts the 3 containers. Then open **http://localhost:3000**.

| Command | What it does |
|---|---|
| `./podman-run.sh status` | Containers, images, network, volume |
| `./podman-run.sh logs` | Last 15 log lines of each container |
| `./podman-run.sh inspect` | IP, ports, mounts, health of each container, network subnet, volume mountpoint |
| `./podman-run.sh test` | Calls the app from the host and from container to container, and looks inside the containers |
| `./podman-run.sh stop` / `start` | Stop / start the containers (data kept) |
| `./podman-run.sh down` | Remove the containers (network + volume + data kept) |
| `./podman-run.sh push <dockerhub-user>` | Tag and push both images to Docker Hub |
| `./podman-run.sh clean` | Remove everything, **including the data volume** |

## Option B: the raw Podman commands (what the script runs)

```bash
# 1. Build custom images from the Containerfiles (version tag + latest)
#    --format docker keeps the HEALTHCHECK instruction (Podman's default OCI format drops it)
podman build --format docker -t localhost/hmt-backend:1.0  -t localhost/hmt-backend:latest  -f backend/Containerfile  backend
podman build --format docker -t localhost/hmt-frontend:1.0 -t localhost/hmt-frontend:latest -f frontend/Containerfile frontend
podman images

# 2. Network and volume
podman network create hmt-net
podman volume create hmt-mongo-data

# 3. Database: on the network, data in the volume, NO host port
podman run -d --name hmt-mongo --network hmt-net --network-alias mongo \
  -v hmt-mongo-data:/data/db --restart unless-stopped \
  docker.io/library/mongo:7

# 4. API: host port 5000 -> container port 5000
podman run -d --name hmt-backend --network hmt-net --network-alias backend \
  -e MONGO_URI=mongodb://mongo:27017/hostel_maintenance -e PORT=5000 -e JWT_SECRET=change-me \
  -p 5000:5000 --restart unless-stopped \
  localhost/hmt-backend:1.0

# 5. Web UI: host port 3000 -> container port 80
podman run -d --name hmt-frontend --network hmt-net --network-alias frontend \
  -p 3000:80 --restart unless-stopped \
  localhost/hmt-frontend:1.0

podman ps
```

## Option C: compose

```bash
podman compose up -d --build
```
```bash
podman compose down
```
[`compose.yaml`](compose.yaml) declares the same 3 containers, the `hmt-net` network and the `hmt-mongo-data` volume. It needs `podman-compose` or Docker Compose installed, and `docker compose up -d --build` works too.

---

## Container management (lifecycle)

```bash
podman ps -a                                   # list running + stopped containers
podman logs -f hmt-backend                     # follow logs (Ctrl+C to exit)
podman inspect hmt-backend                     # full JSON: state, IP, mounts, env, ports
podman inspect -f '{{.State.Health.Status}}' hmt-backend   # healthy / unhealthy
podman port hmt-frontend                       # 80/tcp -> 0.0.0.0:3000
podman stats --no-stream                       # CPU / memory per container (cgroups)
podman top hmt-backend                         # processes inside the container
podman exec -it hmt-backend sh                 # shell inside the container
podman stop hmt-frontend && podman start hmt-frontend
podman restart hmt-backend
podman rm -f hmt-frontend                      # remove a container
podman rmi localhost/hmt-frontend:1.0          # remove an image
```

## Networking

```bash
podman network ls
podman network inspect hmt-net                 # subnet, gateway, dns_enabled: true
podman inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' hmt-backend
podman exec hmt-frontend wget -qO- http://backend:5000/api/health   # container -> container by name
curl http://localhost:5000/api/health                               # host -> container via port mapping
```
- Containers on `hmt-net` find each other **by name** (`mongo`, `backend`) through Podman's DNS (aardvark-dns).
- Nginx in the frontend forwards `/api/` to `http://backend:5000` ([`frontend/nginx.conf`](frontend/nginx.conf)).
- MongoDB has **no published port**, so it cannot be reached from outside the network.

## Persistent storage (prove it in the demo)

```bash
# 1. Add a request in the UI, then delete ALL containers:
podman rm -f hmt-frontend hmt-backend hmt-mongo
# 2. Start them again (the script reuses the existing volume):
./podman-run.sh up
# 3. Refresh the page: the request is still there.
podman volume inspect hmt-mongo-data          # "Mountpoint" = where the data lives on the host
podman exec hmt-mongo ls -la /data/db          # MongoDB's files inside the volume
```
Only `./podman-run.sh clean` (or `podman volume rm hmt-mongo-data`) deletes the data.

## Registry: push, pull and versioning

```bash
podman login docker.io                         # your Docker Hub username + password/token
./podman-run.sh push <your-dockerhub-username>
# same as:
podman tag localhost/hmt-backend:1.0 docker.io/<user>/hmt-backend:1.0
podman push docker.io/<user>/hmt-backend:1.0
# pull it back (e.g. on another machine)
podman pull docker.io/<user>/hmt-backend:1.0
```
Public image links (after pushing):
- `https://hub.docker.com/r/<user>/hmt-backend`
- `https://hub.docker.com/r/<user>/hmt-frontend`

For a new version, change `VERSION` in `podman-run.sh` (e.g. `1.1`), then run `up` and `push`. The old `1.0` tag stays in the registry.

---

## Troubleshooting

| Problem | Check with | Fix |
|---|---|---|
| `Cannot connect to Podman` / `podman machine` not running | `podman machine list` | `podman machine start` |
| `port 3000/5000 already in use` | `podman ps`, or `netstat -ano \| findstr :3000` on Windows | Stop the other program, or change the host side: `-p 3001:80` |
| Container exits right away | `podman ps -a`, `podman logs hmt-backend` | Read the error in the logs. The API retries Mongo for 30 s before giving up |
| Backend `unhealthy` / API says `db: disconnected` | `podman inspect -f '{{.State.Health.Status}}' hmt-mongo` | Start `hmt-mongo` first and make sure both are on `hmt-net` |
| Nginx: `host not found in upstream "backend"` | `podman logs hmt-frontend` | Start `hmt-backend` (with `--network-alias backend`) before the frontend |
| Name not resolving between containers | `podman network inspect hmt-net` | Containers must be on the same user-defined network (the default `podman` network has no DNS) |
| `HEALTHCHECK is not supported for OCI image format` warning | Shown by `podman build` | Build with `--format docker` (the script does) |
| `short-name resolution` prompt for an image | Shown by `podman pull` | Use full names like `docker.io/library/mongo:7` (all files here do) |
| Data gone after restart | `podman volume ls` | You ran `clean` or `volume rm`. Containers must mount `hmt-mongo-data` |
| Old login fails after resetting data | Browser shows "Account no longer exists" | Log out and log in again |

---

## Using the app

### Logins (fictional demo accounts)

| Role | Email | Password | Can do |
|---|---|---|---|
| Warden (admin) | `admin@hostel.test` | `admin123` | See **all** requests, unresolved-by-priority view, set priority, change status, **Resolve** (with a fix note), **Close**, Insights tab |
| Student | `riya@hostel.test` (also arjun, sneha, kabir, meera, vikram, ananya, rohan `@hostel.test`) | `student123` | Submit requests **for their own room** (locked to the account), see only their own requests, withdraw an Open request, rate the fix |

### Requirements covered

| Requirement | Where |
|---|---|
| Submit request (room label, issue category, description) | Form → `POST /api/requests` ([backend/routes/requests.js](backend/routes/requests.js)) |
| List requests | "All requests" tab with search and status/priority/category filters → `GET /api/requests` |
| Set priority (warden) | Priority dropdown → `PATCH /api/requests/:id/priority` |
| Update status (warden) | Status dropdown (Open / In Progress / Resolved) → `PATCH /api/requests/:id/status` |
| Resolve / close (warden) | "Resolve" + fix note → `PATCH /:id/resolve`; "Close" (locks it) → `PATCH /:id/close` |
| **Variation: unresolved by priority** | Default tab → `GET /api/requests/unresolved`: Open + In Progress only, grouped Critical → High → Medium → Low, oldest first |
| **Persistence** | MongoDB data in the Podman volume `hmt-mongo-data` |
| **Fictional data** | [`backend/seed.js`](backend/seed.js): 1 warden, 8 students, 9 requests, inserted only when the DB is empty |

### Extra features
- Room is **locked to the student's account**. The server ignores any room a student sends.
- Purple UI with light/dark mode, icon category picker, progress tracker on each request.
- **Overdue** flag (Critical 24h, High 48h, Medium 4d, Low 7d), **Withdraw**, **Rate the fix** (1–5 ★), warden **Insights** (resolution rate, avg. fix time, ratings, by-category chart).
- Passwords hashed with **bcrypt**, sessions with **JWT**; roles enforced on the server (student → admin route = `403`).

### API quick test
```bash
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@hostel.test","password":"admin123"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
curl -H "Authorization: Bearer $TOKEN" localhost:5000/api/requests/unresolved
```

## Run without containers (development)

This needs a local MongoDB on `localhost:27017`.
```bash
cd backend && npm install && npm run dev      # API on :5000
cd frontend && npm install && npm run dev     # UI on :5173 (proxies /api to :5000)
```

## Project structure

```
backend/
  Containerfile        API image: node:20-alpine, non-root user, HEALTHCHECK
  server.js            Express app, Mongo connection with retry, error handler
  routes/requests.js   request endpoints (submit, list, unresolved, priority, status, resolve, close, stats, rate)
  routes/auth.js       login, register, me
  models/Request.js    schema + validation, priorityRank for sorting
  models/User.js       bcrypt-hashed users, student/admin role, roomLabel
  middleware/auth.js   JWT verify, requireRole("admin")
  seed.js              fictional data
frontend/
  Containerfile        multi-stage: build with Node, serve with nginx:alpine
  nginx.conf           serves the React build, proxies /api -> backend:5000
  src/App.jsx          dashboard (student / warden views)
  src/Login.jsx        login + student sign-up
compose.yaml           3 services + hmt-net network + hmt-mongo-data volume
podman-run.sh          build / run / manage / push with plain Podman commands
```

Change `JWT_SECRET` before deploying anywhere real.
