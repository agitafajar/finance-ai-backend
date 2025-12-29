const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // 587 pakai STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOTPEmail(to, otp) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px">
      <h2>Kode OTP Kamu</h2>
      <p>Gunakan kode ini untuk verifikasi akunmu:</p>
      <div style="font-size:28px;font-weight:bold;letter-spacing:4px;padding:12px;background:#f3f3f3;text-align:center;border-radius:8px">
        ${otp}
      </div>
      <p style="margin-top:12px;color:#555">
        Kode ini berlaku <b>5 menit</b>. Jangan bagikan ke siapapun.
      </p>
      <hr/>
      <p style="color:#999;font-size:12px">
        Jika kamu tidak merasa mendaftar, abaikan email ini.
      </p>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: "Kode OTP Verifikasi - Financialku",
    html,
  });
}

module.exports = { sendOTPEmail };

