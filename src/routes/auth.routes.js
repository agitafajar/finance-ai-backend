const router = require("express").Router();
const auth = require("../controllers/auth.controller");

router.post("/register", auth.register);
router.post("/verify-otp", auth.verifyOtp);
router.post("/resend-otp", auth.resendOtp);
// Profil
router.get("/me", require("../middleware/auth.middleware"), auth.getProfile);
router.put(
  "/profile",
  require("../middleware/auth.middleware"),
  auth.updateProfile
);

router.post("/login", auth.login);

module.exports = router;
