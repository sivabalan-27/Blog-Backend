// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const admin = require("./firebaseAdmin");

const app = express();

// ---------- Allowed origins (supports comma-separated list) ----------
const envOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// If no origins provided and we're not in production, allow localhost for dev convenience
const allowedOrigins = envOrigins.length > 0
  ? envOrigins
  : (process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173", "http://localhost:3000"]);

console.log("CORS allowed origins:", allowedOrigins.length ? allowedOrigins : "(none)");

// ---------- CORS middleware ----------
const corsOptions = {
  origin: function(origin, callback) {
    // allow non-browser requests like curl/postman (no origin)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`🚫 Blocked CORS request from: ${origin}`);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight handler

// Middleware
app.use(express.json());

// ---------- MongoDB connection ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ---------- Routes ----------
app.use("/api/projects", require("./routes/projectRoutes"));
if (require.resolve.length) {
  /* keep potential other routes */
}
app.use("/api/users", require("./routes/userRoutes"));

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "🌍 Backend API is running!",
    firebase: admin && admin.apps && admin.apps.length ? "✅ Admin initialized" : "⚠️ Not initialized",
    allowedOrigins,
  });
});

// 404 Handler
app.use((req, res) => res.status(404).json({ message: "🚫 Route not found" }));

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err && err.message ? err.message : err);
  if (err && err.message && err.message.includes("CORS")) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} [ENV: ${process.env.NODE_ENV || "dev"}]`)
);
