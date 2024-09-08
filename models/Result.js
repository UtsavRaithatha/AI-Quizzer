const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Quiz",
  },
  score: {
    type: Number,
    required: true,
  },
  attempt: {
    type: Number,
    default: 1,
  },
  responses: [
    {
      questionId: {
        type: Number,
        required: true,
      },
      userResponse: {
        type: String,
        required: true,
      },
    },
  ],
  completedAt: {
    type: Date,
    default: Date.now,
  },
});

const Result = mongoose.model("Result", resultSchema);

module.exports = Result;
