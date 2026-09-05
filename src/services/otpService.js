import { Resend } from "resend";

// ==========================================
// SEND OTP BY EMAIL
// ==========================================

const sendOTPByEmail = async ({ email, otp }) => {
  if (!email) {
    throw new Error("Email is required");
  }

  if (!otp) {
    throw new Error("OTP is required");
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM is not configured");
  }

  // Create Resend client only after environment variables are verified
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: [email],
      subject: "WAGBA Password Reset Verification Code",

      text: `
Your WAGBA verification code is ${otp}.

This code will expire in 10 minutes.

If you did not request a password reset, you can safely ignore this email.

— WAGBA Team
      `.trim(),

      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>WAGBA Password Reset</title>
          </head>

          <body style="
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
            font-family: Arial, Helvetica, sans-serif;
          ">

            <div style="
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              padding: 40px 30px;
              border-radius: 12px;
              box-sizing: border-box;
            ">

              <h2 style="
                margin: 0 0 15px;
                color: #111111;
                font-size: 24px;
              ">
                WAGBA Password Reset
              </h2>

              <p style="
                color: #555555;
                font-size: 16px;
                line-height: 1.6;
              ">
                We received a request to reset your WAGBA account password.
              </p>

              <p style="
                color: #555555;
                font-size: 16px;
              ">
                Your verification code is:
              </p>

              <div style="
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                padding: 20px;
                background-color: #f5f5f5;
                color: #111111;
                text-align: center;
                margin: 25px 0;
                border-radius: 8px;
              ">
                ${otp}
              </div>

              <p style="
                color: #555555;
                font-size: 15px;
                line-height: 1.6;
              ">
                This verification code will expire in
                <strong>10 minutes</strong>.
              </p>

              <p style="
                color: #777777;
                font-size: 14px;
                line-height: 1.6;
              ">
                If you did not request a password reset, you can safely
                ignore this email.
              </p>

              <p style="
                color: #555555;
                font-size: 15px;
                margin-top: 30px;
              ">
                — WAGBA Team
              </p>

            </div>

          </body>
        </html>
      `,
    });

    if (error) {
      console.error("Resend OTP Email Error:", error);
      throw new Error(error.message || "Failed to send OTP email");
    }

    console.log("OTP email sent successfully:", data?.id);

    return data;
  } catch (error) {
    console.error("Send OTP Email Error:", error);
    throw error;
  }
};

// ==========================================
// SEND OTP
// ==========================================

export const sendOTP = async ({ email, phone, otp }) => {
  if (!otp) {
    throw new Error("OTP is required");
  }

  let emailSent = false;
  let smsSent = false;

  // ========================================
  // EMAIL
  // ========================================

  if (email) {
    await sendOTPByEmail({
      email,
      otp,
    });

    emailSent = true;
  }

  // ========================================
  // SMS
  // ========================================

  /*
   * Add your Bird SMS service here if needed.
   */

  // ========================================
  // VALIDATE DELIVERY
  // ========================================

  if (!emailSent && !smsSent) {
    throw new Error("No valid OTP delivery method was provided");
  }

  return {
    success: true,
    emailSent,
    smsSent,
  };
};

export default sendOTP;
