const express = require("express");
const router = express.Router();
const admin = require("../firebaseAdmin");
const User = require("../models/User");
const Project = require("../models/Project");

// 🔐 Verify Firebase token
async function verifyFirebaseToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.split("Bearer ")[1];

  try {
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    console.warn("⚠️ Invalid Firebase token:", err.message);
    return null;
  }
}

/* ============================================================
   👤 1) GET OWN PROFILE (/me)
   ============================================================ */
router.get("/me", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded) return res.status(401).json({ message: "Unauthorized" });

    const userId = decoded.uid;
    let user = await User.findOne({ userId });

    // If user not found, create default user
    if (!user) {
      user = await User.create({
        userId,
        email: decoded.email,
        name: decoded.name || "",
        bio: "",
        isProfileComplete: false
      });
    }

    // Fetch user's projects
    const projects = await Project.find({ userId }).sort({ createdAt: -1 });

    const totalLikes = projects.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = projects.reduce(
      (sum, p) => sum + (p.comments?.length || 0),
      0
    );

    res.json({
      profile: user,
      totalProjects: projects.length,
      totalLikes,
      totalComments,
      projects
    });
  } catch (err) {
    console.error("🔥 Error fetching profile:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   👤 2) GET OTHER USER PROFILE (/api/users/:userId)
   ============================================================ */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === "me")
      return res.status(400).json({ message: "Invalid route" });

    const user = await User.findOne({ userId });
    if (!user)
      return res.status(404).json({ message: "User profile not found" });

    const projects = await Project.find({ userId }).sort({ createdAt: -1 });

    const totalLikes = projects.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = projects.reduce(
      (sum, p) => sum + (p.comments?.length || 0),
      0
    );

    res.json({
      profile: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        bio: user.bio,
        createdAt: user.createdAt,
        isProfileComplete: user.isProfileComplete
      },
      totalProjects: projects.length,
      totalLikes,
      totalComments,
      projects
    });
  } catch (err) {
    console.error("🔥 Error fetching user profile:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   ✏️ 3) UPDATE OWN PROFILE (/me)
   ============================================================ */
router.put("/me", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded) return res.status(401).json({ message: "Unauthorized" });

    const userId = decoded.uid;
    const { name, bio } = req.body;

    const isProfileComplete =
      name && bio && name.trim() !== "" && bio.trim() !== "";

    const updatedUser = await User.findOneAndUpdate(
      { userId },
      {
        name,
        bio,
        isProfileComplete
      },
      { new: true, upsert: true }
    );

    res.json(updatedUser);
  } catch (err) {
    console.error("🔥 Error updating profile:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
