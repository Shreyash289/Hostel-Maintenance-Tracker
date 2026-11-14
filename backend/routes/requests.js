const express = require("express");
const mongoose = require("mongoose");
const { Request, CATEGORIES, PRIORITIES, STATUSES, UNRESOLVED } = require("../models/Request");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const adminOnly = requireRole("admin");

const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: "Invalid request id" });

async function findOr404(id, res) {
  const doc = await Request.findById(id);
  if (!doc) res.status(404).json({ error: "Request not found" });
  return doc;
}

// Students only ever see their own requests; admins see everything.
const scope = (user) => (user.role === "admin" ? {} : { student: user._id });

// GET /api/requests/meta  -> dropdown values (public, used by the login/register screen too)
router.get("/meta", (_req, res) => res.json({ categories: CATEGORIES, priorities: PRIORITIES, statuses: STATUSES }));

router.use(requireAuth); // everything below needs a logged-in user

// GET /api/requests/unresolved  -> ASSIGNED VARIATION: unresolved requests grouped & sorted by priority
router.get("/unresolved", async (req, res, next) => {
  try {
    const items = await Request.find({ ...scope(req.user), status: { $in: UNRESOLVED } })
      .sort({ priorityRank: 1, createdAt: 1 }) // most urgent first, oldest first within a priority
      .lean();
    const groups = PRIORITIES.map((p) => ({ priority: p, items: items.filter((r) => r.priority === p) }));
    res.json({ total: items.length, groups });
  } catch (e) { next(e); }
});

// GET /api/requests?status=&priority=&category=&q=  -> list requests (newest first)
router.get("/", async (req, res, next) => {
  try {
    const { status, priority, category, q } = req.query;
    const filter = scope(req.user);
    if (status && STATUSES.includes(status)) filter.status = status;
    if (priority && PRIORITIES.includes(priority)) filter.priority = priority;
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ roomLabel: rx }, { description: rx }, { studentName: rx }];
    }
    res.json(await Request.find(filter).sort({ createdAt: -1 }).lean());
  } catch (e) { next(e); }
});

// POST /api/requests  -> submit a request
// Students: name/room come from their account, priority starts at Medium (admin sets it).
router.post("/", async (req, res, next) => {
  try {
    const { roomLabel, studentName, category, description, priority } = req.body;
    const isAdmin = req.user.role === "admin";
    const doc = await Request.create({
      roomLabel: roomLabel || (isAdmin ? "" : req.user.roomLabel),
      category,
      description,
      student: isAdmin ? null : req.user._id,
      studentName: isAdmin ? studentName : req.user.name,
      priority: isAdmin ? priority : "Medium",
    });
    res.status(201).json(doc);
  } catch (e) { next(e); }
});

// ---------- admin-only actions ----------

// PATCH /api/requests/:id/priority  -> set priority
router.patch("/:id/priority", adminOnly, validId, async (req, res, next) => {
  try {
    if (!PRIORITIES.includes(req.body.priority)) return res.status(400).json({ error: `priority must be one of ${PRIORITIES.join(", ")}` });
    const doc = await findOr404(req.params.id, res);
    if (!doc) return;
    if (doc.status === "Closed") return res.status(409).json({ error: "Closed requests cannot be changed" });
    doc.priority = req.body.priority;
    res.json(await doc.save());
  } catch (e) { next(e); }
});

// PATCH /api/requests/:id/status  -> update status (Open / In Progress / Resolved)
router.patch("/:id/status", adminOnly, validId, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status) || status === "Closed") return res.status(400).json({ error: "status must be Open, In Progress or Resolved (use /close to close)" });
    const doc = await findOr404(req.params.id, res);
    if (!doc) return;
    if (doc.status === "Closed") return res.status(409).json({ error: "Request is already closed" });
    doc.status = status;
    res.json(await doc.save());
  } catch (e) { next(e); }
});

// PATCH /api/requests/:id/resolve  { note }  -> mark the complaint solved, with what was done
router.patch("/:id/resolve", adminOnly, validId, async (req, res, next) => {
  try {
    const note = String(req.body.note || "").trim();
    if (note.length < 3) return res.status(400).json({ error: "Add a short note on what was fixed" });
    const doc = await findOr404(req.params.id, res);
    if (!doc) return;
    if (doc.status === "Closed") return res.status(409).json({ error: "Request is already closed" });
    doc.status = "Resolved";
    doc.resolutionNote = note;
    res.json(await doc.save());
  } catch (e) { next(e); }
});

// PATCH /api/requests/:id/close  { note? }  -> close a request (final, locks it)
router.patch("/:id/close", adminOnly, validId, async (req, res, next) => {
  try {
    const doc = await findOr404(req.params.id, res);
    if (!doc) return;
    if (doc.status === "Closed") return res.status(409).json({ error: "Request is already closed" });
    const note = String(req.body?.note || "").trim();
    if (note) doc.resolutionNote = note;
    doc.status = "Closed";
    res.json(await doc.save());
  } catch (e) { next(e); }
});

module.exports = router;
