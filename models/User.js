const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true }, // Firebase UID
    email: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    bio: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model("User", userSchema);
