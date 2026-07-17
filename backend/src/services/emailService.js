import nodemailer from "nodemailer";

const getTransporter = async () => {
  // If SMTP configurations are in the environment, use them
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback: If no SMTP settings are configured, we create a test Ethereal account
  console.log("No SMTP configurations found in .env, creating a temporary test Ethereal account...");
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

export const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER || '"MeetFlow Team" <no-reply@meetflow.com>',
      to,
      subject,
      html,
    });

    // If we used Ethereal (no SMTP_HOST defined), print and return the preview URL
    if (info.messageId && !process.env.SMTP_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Email Sent via Ethereal] Preview URL: ${previewUrl}`);
      return { success: true, messageId: info.messageId, previewUrl };
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error in sendEmail service:", error);
    throw error;
  }
};
