const nodeMailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

const transporter = nodeMailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

const sendMail = async (to, subject, score, maxScore, feedbackContent) => {
  try {
    const formattedFeedbackContent = feedbackContent.replace(/\n/g, "<br>");

    const mailOptions = {
      from: process.env.EMAIL,
      to,
      subject,
      html: `
  <html>
    <body style="font-family: Arial, sans-serif; color: #2c3e50; margin: 0; padding: 30px; background-color: #f8f9fa; line-height: 1.6;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
        <h1 style="color: #27ae60; font-size: 24px; margin-bottom: 20px;">Your Quiz Result</h1>
        <p style="font-size: 18px; margin-bottom: 10px;">
          <strong>Your score:</strong> ${score}
        </p>
        <p style="font-size: 18px; margin-bottom: 10px;">
          <strong>Max score:</strong> ${maxScore}
        </p>
        <p style="font-size: 18px;">
          <strong>AI generated feedback:</strong><br />
          ${formattedFeedbackContent}
        </p>
      </div>
    </body>
  </html>
`,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error(error);
  }
};

module.exports = sendMail;
