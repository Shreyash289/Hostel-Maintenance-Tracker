const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const requestRoutes = require("./routes/requests");
const authRoutes = require("./routes/auth");
const seedIfEmpty = require("./seed");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hostel_maintenance";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" })
);
app.use("/api/auth", authRoutes);
app.use("/api/requests", requestRoutes);

// Central error handler — turns Mongoose validation errors into 400s.
app.use((err, _req, res, _next) => {
  if (err.code === 11000) return res.status(409).json({ error: "Email already registered" });
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: Object.values(err.errors).map((e) => e.message).join("; ") });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  // Retry so the API waits for the Mongo container to be ready.
  for (let attempt = 1; ; attempt++) {
    try {
      await mongoose.connect(MONGO_URI);
      break;
    } catch (e) {
      if (attempt >= 15) throw e;
      console.log(`Mongo not ready (attempt ${attempt}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log("Connected to MongoDB");
  if (process.env.SEED !== "false" && (await seedIfEmpty())) console.log("Seeded fictional users and requests");
  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}

if (require.main === module) start().catch((e) => { console.error(e); process.exit(1); });

module.exports = app;
