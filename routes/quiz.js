const express = require("express");
const router = express.Router();

const {
  generateQuiz,
  submitQuiz,
  quizHistoryWithFilter,
  getQuiz,
  getHintForQuestion,
} = require("../controllers/quiz");

router.post("/generate", generateQuiz);
router.get("/get/:quizId", getQuiz);
router.post("/submit", submitQuiz);
router.get("/history", quizHistoryWithFilter);
router.get("/hint", getHintForQuestion);

module.exports = router;
