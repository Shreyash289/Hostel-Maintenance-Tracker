const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";

const signToken = (user) => jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

// Requires a valid "Authorization: Bearer <token>" header; attaches req.user.
async function requireAuth(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) return res.status(401).json({ error: "Please log in" });
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(id);
    if (!user) return res.status(401).json({ error: "Account no longer exists" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Session expired, please log in again" });
  }
}

const requireRole = (role) => (req, res, next) =>
  req.user?.role === role ? next() : res.status(403).json({ error: `Only ${role}s can do this` });

module.exports = { signToken, requireAuth, requireRole };
