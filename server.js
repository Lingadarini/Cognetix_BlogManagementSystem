require("dotenv").config();

const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/posts");

const app = express();
const PORT = process.env.PORT || 5000;

// ---------- Middleware ----------
app.use(helmet());
app.use(express.json({ limit: "50kb" }));
app.use(cookieParser());

// Serve the frontend
app.use(express.static(path.join(__dirname, "public")));

// If the database is down, tell the user clearly instead of hanging
app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: "The database is unavailable right now. Please try again shortly." });
  }
  next();
});

// ---------- Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found." });
});

// ---------- Error handler ----------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body." });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large." });
  }
  if (err.name === "ValidationError") {
    const first = Object.values(err.errors)[0];
    return res.status(400).json({ message: first ? first.message : "Invalid data." });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID or value." });
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server. Please try again." });
});

// ---------- Start ----------
async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.error("Missing or too short JWT_SECRET. Copy .env.example to .env and set it.");
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI. Copy .env.example to .env and set it.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;

if (require.main === module) start();
