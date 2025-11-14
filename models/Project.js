const mongoose = require("mongoose");

// 💬 Comment schema
const commentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // Firebase UID
    userEmail: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ⭐ Rating schema
const ratingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    value: { type: Number, required: true, min: 1, max: 5 },
  },
  { _id: false }
);

// 🧱 Main project schema
const projectSchema = new mongoose.Schema(
  {
    // Basic info
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    tags: { type: [String], default: [] },
    githubLink: { type: String, trim: true },
    liveDemo: { type: String, trim: true },

    // 👤 Author info
    userId: { type: String, required: true }, // Firebase UID
    authorName: { type: String, default: "Anonymous User" },
    authorBio: { type: String, default: "" },

    // ❤️ Likes / ⭐ Favorites
    likes: { type: Number, default: 0 },
    likedBy: { type: [String], default: [] },
    favoritedBy: { type: [String], default: [] },

    // 💬 Comments
    comments: { type: [commentSchema], default: [] },

    // ⭐ Ratings
    ratings: { type: [ratingSchema], default: [] },
    averageRating: { type: Number, default: 0 },

    // ⏱ Metadata
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
