const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  grade: {
    type: Number,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  maxScore: {
    type: Number,
    required: true,
  },
  difficulty: {
    type: String,
    required: true,
  },
  questions: {
    type: Array,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Quiz = mongoose.model("Quiz", quizSchema);

module.exports = Quiz;
