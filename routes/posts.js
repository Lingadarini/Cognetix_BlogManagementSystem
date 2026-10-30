const express = require("express");
const mongoose = require("mongoose");

const Post = require("../models/Post");
const requireAuth = require("../middleware/auth");

const router = express.Router();

const PAGE_SIZE = 6;

// Only accept plain strings from query/body (blocks NoSQL operator injection)
const str = (v) => (typeof v === "string" ? v.trim() : "");
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Accepts "a, b, c" or ["a", "b"] and returns up to 5 clean lowercase tags
function parseTags(input) {
  let list = [];
  if (Array.isArray(input)) list = input.filter((t) => typeof t === "string");
  else if (typeof input === "string") list = input.split(",");
  const clean = list
    .map((t) => t.trim().toLowerCase().replace(/^#/, ""))
    .filter(Boolean)
    .map((t) => t.slice(0, 20));
  return [...new Set(clean)].slice(0, 5);
}

function toListItem(post) {
  return {
    id: post._id,
    title: post.title,
    excerpt: post.content.length > 160 ? post.content.slice(0, 160).trimEnd() + "..." : post.content,
    category: post.category,
    tags: post.tags,
    author: post.author ? { id: post.author._id, name: post.author.name } : { id: null, name: "Unknown" },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function toDetail(post) {
  return { ...toListItem(post), content: post.content };
}

// GET /api/posts?search=&category=&tag=&page=   (public)
router.get("/", async (req, res, next) => {
  try {
    const search = str(req.query.search).slice(0, 100);
    const category = str(req.query.category);
    const tag = str(req.query.tag).toLowerCase();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const filter = {};
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ title: rx }, { content: rx }, { tags: rx }];
    }
    if (category) filter.category = category;
    if (tag) filter.tags = tag;

    const [total, posts] = await Promise.all([
      Post.countDocuments(filter),
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate("author", "name")
        .lean(),
    ]);

    res.json({
      posts: posts.map(toListItem),
      page,
      pages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
      total,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/categories   (public) - for the category filter
router.get("/categories", async (req, res, next) => {
  try {
    const categories = await Post.distinct("category");
    res.json({ categories: categories.filter(Boolean).sort((a, b) => a.localeCompare(b)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/:id   (public)
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Post not found." });
    }
    const post = await Post.findById(req.params.id).populate("author", "name").lean();
    if (!post) return res.status(404).json({ message: "Post not found." });
    res.json({ post: toDetail(post) });
  } catch (err) {
    next(err);
  }
});

// POST /api/posts   (login required)
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const post = await Post.create({
      title: str(req.body.title),
      content: str(req.body.content),
      category: str(req.body.category) || "General",
      tags: parseTags(req.body.tags),
      author: req.user.id,
    });
    await post.populate("author", "name");
    res.status(201).json({ post: toDetail(post) });
  } catch (err) {
    next(err);
  }
});

// PUT /api/posts/:id   (login required, only the author)
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Post not found." });
    }
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own posts." });
    }

    post.title = str(req.body.title);
    post.content = str(req.body.content);
    post.category = str(req.body.category) || "General";
    post.tags = parseTags(req.body.tags);
    await post.save();
    await post.populate("author", "name");

    res.json({ post: toDetail(post) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/posts/:id   (login required, only the author)
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Post not found." });
    }
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found." });
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own posts." });
    }
    await post.deleteOne();
    res.json({ message: "Post deleted." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
