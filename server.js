// server.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

let admin = require("./firebaseAdmin");
const app = express();

/* ------------------------------------------
   🔒 Normalize allowed origins (fix slash)
------------------------------------------ */
const rawOrigins = (
  process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const normalizeOrigin = (val) => {
  if (!val) return null;
  try {
    const u = new URL(val);
    return (
      `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}`.toLowerCase()
    );
  } catch (e) {
    return val.replace(/\/+$/, "").toLowerCase(); // strip trailing slash
  }
};

const allowedOrigins = [
  ...new Set(rawOrigins.map(normalizeOrigin).filter(Boolean)),
];

if (allowedOrigins.length === 0 && process.env.NODE_ENV !== "production") {
  allowedOrigins.push("http://localhost:5173", "http://localhost:3000");
}

console.log("CORS allowed origins (normalized):", allowedOrigins);

/* ------------------------------------------
   🌐 CORS Configuration (PATCHED)
------------------------------------------ */
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    const norm = normalizeOrigin(origin);

    if (allowedOrigins.includes(norm)) {
      return callback(null, true);
    } else {
      console.warn("🚫 Blocked CORS origin:", origin, "->", norm);
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Authorization"],
};

app.use(cors(corsOptions));

// ❗ DO NOT USE app.options('*', …) — breaks on Render
app.options("/*", cors(corsOptions)); // Fixed


/* ------------------------------------------
   🧱 Core Middleware
------------------------------------------ */
app.use(express.json());

/* ------------------------------------------
   🗃️ MongoDB Connection
------------------------------------------ */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

/* ------------------------------------------
   🔥 Firebase Attach (safe even if null)
------------------------------------------ */
app.use((req, res, next) => {
  req.admin = admin;
  next();
});

/* ------------------------------------------
   🚏 Routes
------------------------------------------ */
app.use("/api/projects", require("./routes/projectRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

/* ------------------------------------------
   ❤️ Health Check
------------------------------------------ */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    firebase:
      admin && admin.apps && admin.apps.length
        ? "initialized"
        : "not-initialized",
    allowedOrigins,
  });
});

/* ------------------------------------------
   ❌ 404 Not Found
------------------------------------------ */
app.use((req, res) =>
  res.status(404).json({ message: "🚫 Route not found" })
);

/* ------------------------------------------
   🔥 Global Error Handler
------------------------------------------ */
app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err?.message || err);

  if (err.message?.includes("CORS")) {
    return res.status(403).json({ error: err.message });
  }

  res.status(500).json({ error: "Internal Server Error" });
});

/* ------------------------------------------
   🚀 Start Server
------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(
    `🚀 Server running on port ${PORT} [ENV: ${process.env.NODE_ENV || "dev"}]`
  )
);
