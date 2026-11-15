const mongoose = require("mongoose");

const CATEGORIES = ["Electrical", "Plumbing", "Furniture", "Cleaning", "Internet", "Pest Control", "Other"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const UNRESOLVED = ["Open", "In Progress"];

// Lower rank = more urgent. Stored so MongoDB can sort by it directly.
const PRIORITY_RANK = { Critical: 1, High: 2, Medium: 3, Low: 4 };

// An unresolved request older than this is flagged "overdue" (target response time per priority).
const H = 36e5;
const OVERDUE_MS = { Critical: 24 * H, High: 48 * H, Medium: 96 * H, Low: 168 * H };

const requestSchema = new mongoose.Schema(
  {
    roomLabel: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // who raised it
    studentName: { type: String, trim: true, maxlength: 60, default: "" },
    category: { type: String, required: true, enum: CATEGORIES },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    priority: { type: String, enum: PRIORITIES, default: "Medium" },
    priorityRank: { type: Number, default: PRIORITY_RANK.Medium },
    status: { type: String, enum: STATUSES, default: "Open" },
    resolutionNote: { type: String, trim: true, maxlength: 300, default: "" }, // what the admin did to fix it
    rating: { type: Number, min: 1, max: 5, default: null }, // student's rating of the fix
    feedback: { type: String, trim: true, maxlength: 300, default: "" },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Keep priorityRank and the resolved/closed timestamps in sync on every save.
requestSchema.pre("save", function (next) {
  this.priorityRank = PRIORITY_RANK[this.priority];
  if (this.status === "Resolved" && !this.resolvedAt) this.resolvedAt = new Date();
  if (UNRESOLVED.includes(this.status)) this.resolvedAt = null;
  if (this.status === "Closed" && !this.closedAt) this.closedAt = new Date();
  if (this.status !== "Closed") this.closedAt = null;
  next();
});

requestSchema.index({ status: 1, priorityRank: 1, createdAt: 1 });
requestSchema.index({ student: 1, createdAt: -1 });

module.exports = {
  Request: mongoose.model("Request", requestSchema),
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  UNRESOLVED,
  PRIORITY_RANK,
  OVERDUE_MS,
};
