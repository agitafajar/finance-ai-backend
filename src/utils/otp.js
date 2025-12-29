const bcrypt = require("bcrypt");

function generateOTP6() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashOTP(otp) {
  return await bcrypt.hash(otp, 10);
}

async function verifyOTP(otp, hash) {
  return await bcrypt.compare(otp, hash);
}

module.exports = { generateOTP6, hashOTP, verifyOTP };

