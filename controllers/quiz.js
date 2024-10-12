const dotenv = require("dotenv");
const Groq = require("groq-sdk");
const { redisClient, redisEnabled } = require("../utils/redisClient.js");

dotenv.config();

const Quiz = require("../models/Quiz.js");
const Result = require("../models/Result.js");
const sendMail = require("../services/emailService");

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const groq = new Groq(GROQ_API_KEY);

const generateQuiz = async (req, res) => {
  try {
    const { Grade, Subject, TotalQuestions, MaxScore, Difficulty } = req.body;

    if (!Grade || !Subject || !TotalQuestions || !MaxScore || !Difficulty) {
      return res.status(400).json({
        message:
          "Grade, Subject, TotalQuestions, MaxScore, and Difficulty are required.",
      });
    }

    const prompt = `Generate a ${Subject} quiz for grade ${Grade} students with ${TotalQuestions} questions. The difficulty should be ${Difficulty}. Each question should be worth 1 point, for a total of ${MaxScore} points. Format the response as a JSON array of objects, where each object represents a question and has the following properties: questionNumber, question, options (an array of 4 possible answers), correctAnswer (the index of the correct option in the options array), hint (a useful hint for answering the question without revealing the correct answer). Don't add filler statements in the response. Only give the JSON array.`;

    const response = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;

    const jsonStart = content.indexOf("[");
    const jsonEnd = content.lastIndexOf("]") + 1;

    if (jsonStart === -1 || jsonEnd === -1) {
      return res.status(500).json({
        message: "Failed to generate the quiz. Please try again.",
      });
    }

    const jsonContent = content.slice(jsonStart, jsonEnd);

    const generatedQuiz = JSON.parse(jsonContent);

    const quiz = new Quiz({
      grade: Grade,
      subject: Subject,
      totalQuestions: TotalQuestions,
      maxScore: MaxScore,
      difficulty: Difficulty,
      questions: generatedQuiz,
    });

    await quiz.save();

    res.json({
      message: "Quiz generated successfully.",
      quizId: quiz._id,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to generate the quiz." });
  }
};

const getQuiz = async (req, res) => {
  try {
    const quizId = req.params.quizId;

    if (!quizId) {
      return res.status(400).json({
        message: "quizId is required.",
      });
    }

    let cachedQuiz;
    if (redisEnabled) {
      try {
        cachedQuiz = await redisClient.get(quizId);
      } catch (error) {
        console.error("Redis get error: ", error);
      }

      if (cachedQuiz) {
        return res.json({
          message: "Quiz retrieved successfully from cache.",
          quiz: JSON.parse(cachedQuiz),
        });
      }
    }

    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found.",
      });
    }

    const quizWithoutHints = quiz.questions.map((question) => {
      const { hint, ...rest } = question;
      return rest;
    });

    if (redisEnabled) {
      try {
        await redisClient.set(quizId, JSON.stringify(quizWithoutHints));
      } catch (error) {
        console.error("Redis set error: ", error);
      }
    }

    res.json({
      message: "Quiz retrieved successfully from DB.",
      quiz: quizWithoutHints,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get the quiz." });
  }
};

const submitQuiz = async (req, res) => {
  const { quizId, responses } = req.body;

  if (!quizId || !responses) {
    return res.status(400).json({
      message: "quizId and responses are required.",
    });
  }

  try {
    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found.",
      });
    }

    let score = 0;

    const wrongResponses = [];

    responses.forEach((response) => {
      const question = quiz.questions[response.questionId - 1];

      if (question && response.userResponse) {
        if (Number(response.userResponse) === question.correctAnswer) {
          score++;
        } else {
          wrongResponses.push({
            question: question.question,
            userResponse: question.options[parseInt(response.userResponse)],
            correctAnswer: question.options[question.correctAnswer],
          });
        }
      }
    });

    const attemptNumber = await Result.countDocuments({
      userId: req.user._id,
      quizId,
    });

    const quizResult = new Result({
      userId: req.user._id,
      quizId,
      score,
      attempt: attemptNumber + 1,
      responses,
    });

    await quizResult.save();

    const wrongResponsesText =
      wrongResponses.length > 0
        ? `${wrongResponses
            .map(
              (response) =>
                `Question: ${response.question}\nStudent Answer: ${response.userResponse}\nCorrect Answer: ${response.correctAnswer}`
            )
            .join("\n\n")}`
        : "No incorrect responses.";

    const prompt = `
The score of the student is ${score} out of ${quiz.maxScore}.
Here is the list of wrong responses to the quiz:
${wrongResponsesText}

Based on the above responses, provide a topic-wise feedback on which topics the student needs to improve and on which topics the student is strong. If the user has all correct answers, provide a congratulatory message.

**Instructions:**
- Avoid using phrases like "it seems that" or other filler language.
- Be direct and clear in your feedback.
- Also include a general feedback based on quiz score and performance.
- Answer in dot bullets (•) with newline character and dont include wrong responses in the feedback.
- Provide only the feedback in a single message, addressing the student using "you".
`;

    const promptResponse = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
    });

    const feedbackContent = promptResponse.choices[0]?.message?.content;

    await sendMail(
      req.user.email,
      `${quiz.subject} Quiz Result`,
      score,
      quiz.maxScore,
      feedbackContent
    );

    res.json({
      message:
        "Quiz submitted successfully. An AI generated feedback is sent to your registered email ID.",
      score,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to submit the quiz." });
  }
};

const quizHistoryWithFilter = async (req, res) => {
  const { quizId, subject, grade, fromDate, toDate, score } = req.query;

  try {
    let filter = { userId: req.user._id };

    if (quizId) {
      filter.quizId = quizId;
    }

    if (score) {
      filter.score = score;
    }

    if (fromDate && toDate) {
      const fromCmp = new Date(fromDate);
      const toCmp = new Date(toDate);

      toCmp.setHours(23, 59, 59, 999);

      filter.completedAt = {
        $gte: fromCmp,
        $lte: toCmp,
      };
    }

    let results = await Result.find(filter).populate({
      path: "quizId",
      select: "subject grade",
    });

    if (grade) {
      results = results.filter(
        (result) => result.quizId.grade === parseInt(grade)
      );
    }

    if (subject) {
      results = results.filter((result) => result.quizId.subject === subject);
    }

    res.json({ results });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get quiz history." });
  }
};

const getHintForQuestion = async (req, res) => {
  const { quizId, questionId } = req.query;

  if (!quizId || !questionId) {
    return res.status(400).json({
      message: "quizId and questionId are required.",
    });
  }

  try {
    const quiz = await Quiz.findById(quizId);

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found.",
      });
    }

    const question = quiz.questions[parseInt(questionId) - 1];

    if (!question) {
      return res.status(404).json({
        message: "Question not found.",
      });
    }

    res.json({
      message: "Hint retrieved successfully.",
      hint: question.hint,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to get the hint." });
  }
};

module.exports = {
  generateQuiz,
  submitQuiz,
  quizHistoryWithFilter,
  getQuiz,
  getHintForQuestion,
};
