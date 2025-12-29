const pool = require("../config/db");
const bcrypt = require("bcrypt");
const dayjs = require("dayjs");

const { generateOTP6, hashOTP, verifyOTP } = require("../utils/otp");
const { signToken } = require("../utils/jwt");
const { sendOTPEmail } = require("../utils/mailer"); // ✅ INI PENTING

const OTP_EXPIRE_MINUTES = Number(process.env.OTP_EXPIRE_MINUTES || 5);

// ============================
// REGISTER (buat user + kirim OTP)
// ============================
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    // cek sudah ada?
    const exists = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (exists.rowCount > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // create user
    const password_hash = await bcrypt.hash(password, 10);

    const userRes = await pool.query(
      `INSERT INTO users(name, email, password_hash, is_verified)
       VALUES($1,$2,$3,false)
       RETURNING id, name, email, is_verified`,
      [name || null, email, password_hash]
    );

    const user = userRes.rows[0];

    // generate OTP
    const otp = generateOTP6();
    const otp_hash = await hashOTP(otp);
    const expires_at = dayjs().add(OTP_EXPIRE_MINUTES, "minute").toDate();

    await pool.query(
      `INSERT INTO otp_verifications(user_id, otp_hash, expires_at)
       VALUES($1,$2,$3)`,
      [user.id, otp_hash, expires_at]
    );

    // ✅ kirim OTP via email
    await sendOTPEmail(email, otp);

    return res.json({ message: "OTP sent to email", email });
  } catch (e) {
    return res.status(500).json({ message: "Register failed", error: e.message });
  }
};

// ============================
// VERIFY OTP
// ============================
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email & OTP required" });
    }

    const userRes = await pool.query("SELECT id, email, is_verified FROM users WHERE email=$1", [email]);
    if (userRes.rowCount === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = userRes.rows[0];

    if (user.is_verified) {
      const token = signToken(user);
      return res.json({ message: "Already verified", token });
    }

    const otpRes = await pool.query(
      `SELECT * FROM otp_verifications
       WHERE user_id=$1 AND verified=false
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (otpRes.rowCount === 0) {
      return res.status(400).json({ message: "OTP not found" });
    }

    const record = otpRes.rows[0];

    if (new Date(record.expires_at) < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const valid = await verifyOTP(otp, record.otp_hash);
    if (!valid) {
      return res.status(400).json({ message: "OTP invalid" });
    }

    await pool.query("UPDATE otp_verifications SET verified=true WHERE id=$1", [record.id]);
    await pool.query("UPDATE users SET is_verified=true WHERE id=$1", [user.id]);

    const token = signToken(user);
    return res.json({ message: "Verified", token });
  } catch (e) {
    return res.status(500).json({ message: "Verify failed", error: e.message });
  }
};

// ============================
// RESEND OTP
// ============================
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }

    const userRes = await pool.query("SELECT id, email, is_verified FROM users WHERE email=$1", [email]);
    if (userRes.rowCount === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = userRes.rows[0];
    if (user.is_verified) {
      return res.status(400).json({ message: "Already verified" });
    }

    // cooldown 60 detik
    const lastOtp = await pool.query(
      `SELECT created_at FROM otp_verifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (lastOtp.rowCount > 0) {
      const lastTime = new Date(lastOtp.rows[0].created_at).getTime();
      if (Date.now() - lastTime < 60 * 1000) {
        return res.status(429).json({ message: "Wait 60 seconds before resend" });
      }
    }

    const otp = generateOTP6();
    const otp_hash = await hashOTP(otp);
    const expires_at = dayjs().add(OTP_EXPIRE_MINUTES, "minute").toDate();

    await pool.query(
      `INSERT INTO otp_verifications(user_id, otp_hash, expires_at)
       VALUES($1,$2,$3)`,
      [user.id, otp_hash, expires_at]
    );

    await sendOTPEmail(email, otp);

    return res.json({ message: "OTP resent to email", email });
  } catch (e) {
    return res.status(500).json({ message: "Resend failed", error: e.message });
  }
};

// ============================
// LOGIN
// ============================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email & password required" });
    }

    const userRes = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (userRes.rowCount === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = userRes.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ message: "Wrong password" });
    }

    if (!user.is_verified) {
      return res.status(403).json({ message: "Email not verified" });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (e) {
    return res.status(500).json({ message: "Login failed", error: e.message });
  }
};
