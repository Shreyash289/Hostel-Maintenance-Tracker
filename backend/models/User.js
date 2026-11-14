const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, match: [/^\S+@\S+\.\S+$/, "Invalid email"] },
    password: { type: String, required: true, minlength: 6, select: false }, // stored as a bcrypt hash
    role: { type: String, enum: ["student", "admin"], default: "student" },
    roomLabel: { type: String, trim: true, uppercase: true, maxlength: 20, default: "" }, // students only
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublic = function () {
  return { id: this._id, name: this.name, email: this.email, role: this.role, roomLabel: this.roomLabel };
};

module.exports = mongoose.model("User", userSchema);
