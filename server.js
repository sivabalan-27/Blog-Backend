// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const admin = require("./firebaseAdmin");

const app = express();

/* ------------------------------------------------
   🔧 Normalize origins (fix trailing slashes)
------------------------------------------------ */
const normalizeOrigin = (val) => {
  if (!val) return null;
  try {
    const u = new URL(val);
    return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`.toLowerCase();
  } catch (e) {
    return val.replace(/\/+$/, "").toLowerCase(); // remove trailing slash
  }
};
 
//{const rawOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "")}

const rawOrigins = (
  process.env.ALLOWED_ORIGINS ||
  `${process.env.FRONTEND_URL || ""},${process.env.FRONTEND_URL2 || ""}`
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = [...new Set(rawOrigins.map(normalizeOrigin).filter(Boolean))];

if (allowedOrigins.length === 0 && process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:5173", "http://localhost:3000");
}

console.log("CORS allowed origins (normalized):", allowedOrigins);

/* ------------------------------------------------
   🌐 SAFE CORS (NO wildcard paths → no Render crash)
------------------------------------------------ */
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow curl/postman
    const norm = normalizeOrigin(origin);

    if (allowedOrigins.includes(norm)) {
      return callback(null, true);
    } else {
      console.warn("🚫 Blocked CORS request from:", origin, "->", norm);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Authorization"],
};

// CORS handler
const corsHandler = cors(corsOptions);

// Apply CORS to all requests
app.use(corsHandler);

// Safe OPTIONS handler (instead of app.options("*"))
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return corsHandler(req, res, (err) => {
      if (err) {
        console.error("CORS preflight error:", err);
        return res.status(403).json({ error: "CORS preflight failed" });
      }
      if (!res.headersSent) return res.sendStatus(204);
    });
  }
  next();
});

/* ------------------------------------------------
   🔌 Middleware
------------------------------------------------ */
app.use(express.json());

/* ------------------------------------------------
   🗄️ MongoDB Connection
------------------------------------------------ */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ------------------------------------------------
   🔥 Firebase Status
------------------------------------------------ */
app.get("/", (req, res) => {
  res.json({
    message: "🌍 Backend API is running!",
    firebase: admin.apps.length ? "✅ Admin initialized" : "⚠️ Not initialized",
    allowedOrigins,
  });
});

/* ------------------------------------------------
   🚏 Routes
------------------------------------------------ */
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

/* ------------------------------------------------
   ❌ 404 Handler
------------------------------------------------ */
app.use((req, res) => res.status(404).json({ message: "🚫 Route not found" }));

/* ------------------------------------------------
   🔥 Global Error Handler
------------------------------------------------ */
app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err.message || err);

  if (err.message?.includes("CORS")) {
    return res.status(403).json({ error: err.message });
  }

  res.status(500).json({ error: "Internal Server Error" });
});

/* ------------------------------------------------
   🚀 Start Server
------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} [ENV: ${process.env.NODE_ENV || "dev"}]`)
);

