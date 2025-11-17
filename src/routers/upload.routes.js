// src/routers/upload.routes.js
import express from "express";
import { getPresignedPost, getChatFileUpload } from "../controllers/upload.controller.js";
import { authGuard } from "../middlewares/authGuard.js";
import { requireRole } from "../middlewares/roles.js";

const router = express.Router();

router.post(
  "/presigned-post",
  authGuard,
  requireRole("host"),
  express.json(),
  getPresignedPost
);
router.post(
  "/public-presigned-post",
  express.json(),
  getPresignedPost
);
router.post(
  "/chat-file",
  authGuard,
  express.json(),
  getChatFileUpload
);

router.get("/debug", (req, res) => {
  res.json({
    region: process.env.S3_REGION,
    bucket: process.env.S3_BUCKET,
    akid: (process.env.AWS_ACCESS_KEY_ID || "").slice(0,4) + "***"
  });
});

export default router;