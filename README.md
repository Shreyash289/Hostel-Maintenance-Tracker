# 🛠️ Hostel Maintenance Tracker (MERN + Docker)

Tracks hostel room maintenance complaints, with **student and admin logins**. Built with **MongoDB, Express, React (Vite), Node.js**, run with **Docker Compose**.
All rooms and students are **fictional**.

## Requirements covered

| Requirement | Where |
|---|---|
| Submit request (room label, issue category, description) | Form (left) → `POST /api/requests` |
| List requests | "All requests" tab, with search + status/priority/category filters → `GET /api/requests` |
| Set priority (admin) | Priority dropdown on each request → `PATCH /api/requests/:id/priority` |
| Update status (admin) | Status dropdown (Open / In Progress / Resolved) → `PATCH /api/requests/:id/status` |
| Resolve complaint (admin) | "Resolve" button + fix note → `PATCH /api/requests/:id/resolve` |
| Close request (admin) | "Close" button (sets `closedAt`, locks the request) → `PATCH /api/requests/:id/close` |
| Login | `POST /api/auth/login`, `POST /api/auth/register` (students), `GET /api/auth/me` |
| **Variation: unresolved by priority** | "Unresolved by priority" tab (default) → `GET /api/requests/unresolved` — Open + In Progress only, grouped Critical → High → Medium → Low, oldest first within each group |
| **Persistence** | MongoDB data lives in the named Docker volume `mongo-data` |
| **Fictional data** | `backend/seed.js` — 1 admin, 8 students, 9 sample requests, inserted only when the DB is empty |

## Logins (fictional demo accounts)

| Role | Email | Password | Can do |
|---|---|---|---|
| Admin (warden) | `admin@hostel.test` | `admin123` | See **all** requests, unresolved-by-priority view, set priority, change status, **Resolve** (with a fix note), **Close**, reopen |
| Student | `riya@hostel.test` (also arjun, sneha, kabir, meera, vikram, ananya, rohan `@hostel.test`) | `student123` | Submit requests for their room, see **only their own** requests, status and the admin's fix note |

New students can sign up from the login screen. Admins can't sign up; they're seeded.
Passwords are hashed with **bcrypt**, sessions use **JWT** (7-day token), and roles are enforced on the **server**: a student calling an admin route gets `403`.

### Complaint lifecycle
`Open` → `In Progress` → **Resolve** (admin writes what was fixed → `Resolved`) → **Close** (locked).
An admin can also close directly, or reopen a Resolved complaint by setting it back to Open / In Progress.

## Run it (Docker)

```bash
docker compose up -d --build
```

- App: http://localhost:3000
- API: http://localhost:5000/api/health

Stop: `docker compose down` (data is kept).
Wipe all data and reseed: `docker compose down -v`.

## Show that data persists (for your demo/viva)

```bash
# 1. add a request in the UI, then:
docker compose down
docker compose up -d
# 2. refresh the page and the request is still there
docker volume ls | grep mongo-data   # the volume holding the data
```

## Run without Docker (dev)

Needs a local MongoDB on `localhost:27017`.

```bash
cd backend && npm install && npm run dev      # API on :5000
cd frontend && npm install && npm run dev     # UI on :5173 (proxies /api to :5000)
```

## Structure

```
backend/
  models/User.js      name, email, bcrypt password, role (student/admin), roomLabel
  middleware/auth.js  JWT sign/verify, requireAuth, requireRole("admin")
  routes/auth.js      login, register, me
  models/Request.js   schema: roomLabel, studentName, category, description,
                      priority (+ priorityRank for sorting), status, student ref,
                      resolutionNote, resolvedAt, closedAt, timestamps
  routes/requests.js  REST endpoints
  seed.js             fictional sample data
  server.js           Express app, Mongo connection with retry, error handler
frontend/
  src/Login.jsx       student/admin login + student sign-up
  src/App.jsx         dashboard: student view / admin view, resolve & close actions
  src/api.js          fetch wrapper
  nginx.conf          serves the React build, proxies /api → backend
docker-compose.yml    mongo + backend + frontend, named volume mongo-data
```

## API quick test

```bash
# log in as admin and keep the token
TOKEN=$(curl -s -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@hostel.test","password":"admin123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -H "Authorization: Bearer $TOKEN" localhost:5000/api/requests/unresolved
```

> If you ran an older version before logins were added, run `docker compose down -v` once so the database is reseeded with the demo accounts.

Change `JWT_SECRET` in `docker-compose.yml` (or set it in your shell) before deploying anywhere real.

Categories: Electrical, Plumbing, Furniture, Cleaning, Internet, Pest Control, Other
Priorities: Critical, High, Medium, Low · Statuses: Open, In Progress, Resolved, Closed
