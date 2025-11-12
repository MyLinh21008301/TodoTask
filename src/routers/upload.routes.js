// src/routers/upload.routes.js (BACKEND)
import express from "express";
import { getPresignedPost, getChatFileUpload } from "../controllers/upload.controller.js";
import { authGuard } from "../middlewares/authGuard.js";
import { requireRole } from "../middlewares/roles.js";

const router = express.Router();

// POST /api/upload/presigned-post (cho host upload listing images)
router.post(
  "/presigned-post",
  authGuard,
  requireRole("host"),
  express.json(),
  getPresignedPost
);

// POST /api/upload/chat-file (cho chat - cả host và guest đều dùng được)
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
