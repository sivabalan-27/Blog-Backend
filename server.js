// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const admin = require("./firebaseAdmin");

const app = express();

// ------------------------------
// ✅ CORS Configuration
// ------------------------------
const allowedOrigins = [
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 Blocked CORS request from: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware
app.use(express.json());

// ------------------------------
// ✅ MongoDB Connection
// ------------------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ------------------------------
// ✅ Routes
// ------------------------------
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

// Health Check
app.get("/", (req, res) => {
  res.json({
    message: "🌍 Backend API is running!",
    firebase: admin.apps.length ? "✅ Admin initialized" : "⚠️ Not initialized",
  });
});

// 404 Handler
app.use((req, res) => res.status(404).json({ message: "🚫 Route not found" }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

// ------------------------------
// ✅ Start Server
// ------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} [ENV: ${process.env.NODE_ENV || "dev"}]`)
);
