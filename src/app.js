const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();
const uploadRoutes = require("./routes/upload.routes");

const authRoutes = require("./routes/auth.routes");
const scanRoutes = require("./routes/scan.routes");

const app = express();

// basic security
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use("/upload", uploadRoutes);
app.use("/scan", scanRoutes);
app.use("/transactions", require("./routes/transactions.routes"));

// anti spam global (basic)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 200, // 200 req per menit
  })
);

app.get("/", (req, res) => {
  res.send("Finance AI Backend OK");
});

app.use("/auth", authRoutes);

module.exports = app;
