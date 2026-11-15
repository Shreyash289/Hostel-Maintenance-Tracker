// Fictional seed data — rooms, students and the admin are all made up.
// Each collection is seeded ONLY when it is empty, so restarts never wipe or duplicate data.
const { Request, PRIORITY_RANK } = require("./models/Request");
const User = require("./models/User");

const daysAgo = (d) => new Date(Date.now() - d * 86400000);

// Demo accounts (passwords are hashed by the User model before saving).
const USERS = [
  { name: "Warden Admin", email: "admin@hostel.test", password: "admin123", role: "admin" },
  { name: "Riya Kapoor", email: "riya@hostel.test", password: "student123", roomLabel: "A-101" },
  { name: "Arjun Mehta", email: "arjun@hostel.test", password: "student123", roomLabel: "B-214" },
  { name: "Sneha Iyer", email: "sneha@hostel.test", password: "student123", roomLabel: "C-305" },
  { name: "Kabir Singh", email: "kabir@hostel.test", password: "student123", roomLabel: "A-118" },
  { name: "Meera Nair", email: "meera@hostel.test", password: "student123", roomLabel: "D-402" },
  { name: "Vikram Rao", email: "vikram@hostel.test", password: "student123", roomLabel: "B-207" },
  { name: "Ananya Das", email: "ananya@hostel.test", password: "student123", roomLabel: "C-311" },
  { name: "Rohan Verma", email: "rohan@hostel.test", password: "student123", roomLabel: "D-409" },
];

const REQUESTS = [
  { email: "riya@hostel.test", category: "Electrical", description: "Ceiling fan sparks when switched to high speed.", priority: "Critical", status: "Open", createdAt: daysAgo(1) },
  { email: "arjun@hostel.test", category: "Plumbing", description: "Bathroom tap leaking continuously, floor stays wet.", priority: "High", status: "In Progress", createdAt: daysAgo(3) },
  { email: "sneha@hostel.test", category: "Internet", description: "Wi-Fi drops every few minutes after 9 PM.", priority: "Medium", status: "Open", createdAt: daysAgo(2) },
  { email: "kabir@hostel.test", category: "Furniture", description: "Study table drawer handle broken off.", priority: "Low", status: "Open", createdAt: daysAgo(6) },
  { email: "meera@hostel.test", category: "Pest Control", description: "Cockroaches seen near the wardrobe and window.", priority: "High", status: "Open", createdAt: daysAgo(4) },
  { email: "vikram@hostel.test", category: "Cleaning", description: "Corridor outside the room not cleaned for three days.", priority: "Medium", status: "Resolved", resolutionNote: "Housekeeping cleaned the corridor; added to daily rota.", resolvedAt: daysAgo(6), createdAt: daysAgo(8) },
  { email: "ananya@hostel.test", category: "Electrical", description: "Tube light flickering, needs replacement.", priority: "Low", status: "Closed", resolutionNote: "Replaced tube light with LED batten.", rating: 5, feedback: "Fixed the same day, thanks!", resolvedAt: daysAgo(8), closedAt: daysAgo(7), createdAt: daysAgo(10) },
  { email: "rohan@hostel.test", category: "Plumbing", description: "Geyser not heating water at all.", priority: "Critical", status: "In Progress", createdAt: daysAgo(2) },
  { email: "riya@hostel.test", category: "Furniture", description: "Wardrobe door hinge loose.", priority: "Low", status: "Closed", resolutionNote: "Hinge screws tightened.", rating: 4, resolvedAt: daysAgo(14), closedAt: daysAgo(13), createdAt: daysAgo(15) },
];

module.exports = async function seedIfEmpty() {
  let seeded = false;
  if ((await User.estimatedDocumentCount()) === 0) {
    for (const u of USERS) await User.create(u); // create() so passwords get hashed
    seeded = true;
  }
  if ((await Request.estimatedDocumentCount()) === 0) {
    const users = await User.find({ role: "student" });
    const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
    const docs = REQUESTS.filter((r) => byEmail[r.email]).map(({ email, ...r }) => ({
      ...r,
      student: byEmail[email]._id,
      studentName: byEmail[email].name,
      roomLabel: byEmail[email].roomLabel,
      priorityRank: PRIORITY_RANK[r.priority],
      resolutionNote: r.resolutionNote || "",
      rating: r.rating || null,
      feedback: r.feedback || "",
      resolvedAt: r.resolvedAt || null,
      closedAt: r.closedAt || null,
      updatedAt: r.createdAt,
    }));
    await Request.collection.insertMany(docs); // raw insert keeps the back-dated timestamps
    seeded = true;
  }
  return seeded;
};
