const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required."],
      trim: true,
      minlength: [3, "Title must be at least 3 characters."],
      maxlength: [120, "Title must be at most 120 characters."],
    },
    content: {
      type: String,
      required: [true, "Content is required."],
      trim: true,
      minlength: [10, "Content must be at least 10 characters."],
      maxlength: [10000, "Content must be at most 10,000 characters."],
    },
    category: {
      type: String,
      trim: true,
      default: "General",
      maxlength: [40, "Category must be at most 40 characters."],
    },
    tags: {
      type: [String],
      default: [],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
