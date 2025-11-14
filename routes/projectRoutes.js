const express = require("express");
const router = express.Router();
const Project = require("../models/Project");
const User = require("../models/User");
const admin = require("../firebaseAdmin");

/* ============================================================
   🔐 VERIFY FIREBASE TOKEN
   ============================================================ */
async function verifyFirebaseToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.split("Bearer ")[1];

  try {
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    console.warn("⚠️ Firebase token failed:", err.message);
    return null;
  }
}

/* ============================================================
   💬 COMMENTS ROUTES (MUST COME FIRST)
   ============================================================ */

// GET all comments for a project
router.get("/:id/comments", async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const comments = [...project.comments].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(comments);
  } catch (err) {
    console.error("🔥 Error fetching comments:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST new comment
router.post("/:id/comments", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized" });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const newComment = {
      userId: decoded.uid,
      userEmail: decoded.email,
      text: req.body.text,
      createdAt: new Date(),
    };

    project.comments.push(newComment);
    await project.save();

    res.status(201).json(project.comments);
  } catch (err) {
    console.error("🔥 Error posting comment:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE comment
router.delete("/:id/comments/:commentId", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized" });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const comment = project.comments.id(req.params.commentId);
    if (!comment)
      return res.status(404).json({ message: "Comment not found" });

    if (comment.userId !== decoded.uid && project.userId !== decoded.uid)
      return res.status(403).json({ message: "Forbidden" });

    comment.deleteOne();
    await project.save();

    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("🔥 Error deleting comment:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   🧱 CREATE PROJECT (PROFILE MUST BE COMPLETE)
   ============================================================ */
router.post("/", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized" });

    const userId = decoded.uid;

    const user = await User.findOne({ userId });

    if (!user || !user.name || !user.bio || user.name.trim() === "" || user.bio.trim() === "") {
      return res.status(403).json({
        message: "Complete your profile (name & bio) before adding a project.",
      });
    }

    const project = new Project({
      ...req.body,
      userId,
      authorName: user.name,
      authorBio: user.bio,
    });

    await project.save();
    res.status(201).json(project);

  } catch (err) {
    console.error("🔥 Error creating project:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   ⭐ FAVORITES (GET MY FAVORITES)
   ============================================================ */
router.get("/favorites/my", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized" });

    const userId = decoded.uid;

    const favorites = await Project.find({ favoritedBy: userId }).sort({ createdAt: -1 });

    const formatted = favorites.map((p) => ({
      ...p.toObject(),
      likedByCurrentUser: p.likedBy.includes(userId),
      favoritedByCurrentUser: true,
      commentCount: p.comments?.length || 0,
      likes: p.likedBy.length,
    }));

    res.json(formatted);

  } catch (err) {
    console.error("🔥 Error fetching favorites:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   👤 GET MY PROJECTS (IMPORTANT: MUST BE ABOVE "/:id")
   ============================================================ */
router.get("/my", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized" });

    const userId = decoded.uid;

    const projects = await Project.find({ userId }).sort({ createdAt: -1 });

    const formatted = projects.map((p) => {
      const avg =
        p.ratings?.length > 0
          ? p.ratings.reduce((a, b) => a + b.value, 0) / p.ratings.length
          : 0;

      return {
        ...p.toObject(),
        likedByCurrentUser: true, // always true for own projects
        favoritedByCurrentUser: p.favoritedBy.includes(userId),
        commentCount: p.comments?.length || 0,
        likes: p.likedBy.length,
        averageRating: parseFloat(avg.toFixed(1)),
      };
    });

    res.json(formatted);

  } catch (err) {
    console.error("🔥 Error fetching my projects:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   📦 GET ALL PROJECTS (PAGINATION)
   ============================================================ */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 9;
    const skip = (page - 1) * limit;

    const decoded = await verifyFirebaseToken(req);
    const userId = decoded?.uid;

    const total = await Project.countDocuments();

    const projects = await Project.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formatted = projects.map((p) => {
      const avg =
        p.ratings?.length > 0
          ? p.ratings.reduce((a, b) => a + b.value, 0) / p.ratings.length
          : 0;

      return {
        ...p.toObject(),
        likedByCurrentUser: userId ? p.likedBy.includes(userId) : false,
        favoritedByCurrentUser: userId ? p.favoritedBy.includes(userId) : false,
        commentCount: p.comments?.length || 0,
        likes: p.likedBy.length,
        averageRating: parseFloat(avg.toFixed(1)),
        userRating: p.ratings?.find((r) => r.userId === userId)?.value || 0,
      };
    });

    res.json({
      projects: formatted,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalProjects: total,
    });

  } catch (err) {
    console.error("🔥 Error fetching projects:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   📦 GET SINGLE PROJECT (THIS MUST COME AFTER /comments & /my)
   ============================================================ */
router.get("/:id", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    const userId = decoded?.uid;

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const avg =
      project.ratings?.length > 0
        ? project.ratings.reduce((a, b) => a + b.value, 0) / project.ratings.length
        : 0;

    res.json({
      ...project.toObject(),
      likedByCurrentUser: userId ? project.likedBy.includes(userId) : false,
      favoritedByCurrentUser: userId ? project.favoritedBy.includes(userId) : false,
      commentCount: project.comments?.length || 0,
      averageRating: parseFloat(avg.toFixed(1)),
      userRating: project.ratings?.find((r) => r.userId === userId)?.value || 0,
    });

  } catch (err) {
    console.error("🔥 Error fetching project:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   ✏️ UPDATE PROJECT
   ============================================================ */
   router.put("/:id", async (req, res) => {
    try {
      const decoded = await verifyFirebaseToken(req);
      if (!decoded) return res.status(401).json({ message: "Unauthorized" });
  
      const userId = decoded.uid;
  
      // Ensure project exists
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });
  
      // Only the owner can update
      if (project.userId !== userId) {
        return res.status(403).json({ message: "You cannot edit this project." });
      }
  
      // Update fields
      project.title = req.body.title;
      project.description = req.body.description;
      project.tags = req.body.tags || [];
      project.githubLink = req.body.githubLink || "";
      project.liveDemo = req.body.liveDemo || "";
  
      await project.save();
  
      res.json({ message: "Project updated", project });
    } catch (err) {
      console.error("🔥 Error updating project:", err);
      res.status(500).json({ error: err.message });
    }
  });
  
/* ============================================================
   ❤️ LIKE / UNLIKE
   ============================================================ */
router.post("/:id/like", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized" });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const userId = decoded.uid;

    if (project.likedBy.includes(userId)) {
      project.likedBy = project.likedBy.filter((i) => i !== userId);
    } else {
      project.likedBy.push(userId);
    }

    project.likes = project.likedBy.length;
    await project.save();

    res.json({
      likes: project.likes,
      liked: project.likedBy.includes(userId),
    });

  } catch (err) {
    console.error("🔥 Error liking project:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   ⭐ FAVORITE / UNFAVORITE
   ============================================================ */
router.post("/:id/favorite", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized" });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const userId = decoded.uid;

    if (project.favoritedBy.includes(userId)) {
      project.favoritedBy = project.favoritedBy.filter((i) => i !== userId);
    } else {
      project.favoritedBy.push(userId);
    }

    await project.save();

    res.json({
      favorited: project.favoritedBy.includes(userId),
      projectId: project._id,
    });

  } catch (err) {
    console.error("🔥 Error favoriting project:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   ⭐ RATE PROJECT
   ============================================================ */
router.post("/:id/rate", async (req, res) => {
  try {
    const decoded = await verifyFirebaseToken(req);
    if (!decoded)
      return res.status(401).json({ message: "Unauthorized" });

    const { value } = req.body;
    const userId = decoded.uid;

    if (value < 1 || value > 5)
      return res.status(400).json({ message: "Rating must be 1–5" });

    const project = await Project.findById(req.params.id);
    if (!project)
      return res.status(404).json({ message: "Project not found" });

    const existing = project.ratings.find((r) => r.userId === userId);

    if (existing) existing.value = value;
    else project.ratings.push({ userId, value });

    const avg =
      project.ratings.reduce((a, b) => a + b.value, 0) /
      project.ratings.length;

    project.averageRating = parseFloat(avg.toFixed(1));
    await project.save();

    res.json({
      averageRating: project.averageRating,
      userRating: value,
    });

  } catch (err) {
    console.error("🔥 Error rating project:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
