const express = require("express");
const User = require("../models/User");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login  { email, password, role }
router.post("/login", async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
    if (!user || !(await user.checkPassword(password))) return res.status(401).json({ error: "Wrong email or password" });
    if (role && user.role !== role) return res.status(403).json({ error: `This is not a ${role} account` });
    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (e) { next(e); }
});

// POST /api/auth/register  { name, email, password, roomLabel }  -> students only (admins are seeded)
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, roomLabel } = req.body;
    if (!/^[A-Za-z]-?\d{2,4}$/.test(String(roomLabel || "").trim())) return res.status(400).json({ error: "Room must look like A-101" });
    if (!password || String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (await User.exists({ email: String(email || "").toLowerCase().trim() })) return res.status(409).json({ error: "Email already registered" });
    const user = await User.create({ name, email, password, roomLabel, role: "student" });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => res.json({ user: req.user.toPublic() }));

module.exports = router;
