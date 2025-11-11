// src/routers/upload.routes.js (BACKEND)
import express from "express";
import { getPresignedPost } from "../controllers/upload.controller.js";
import { authGuard } from "../middlewares/authGuard.js";
import { requireRole } from "../middlewares/roles.js";

const router = express.Router();

// POST /api/upload/presigned-post
router.post(
  "/presigned-post",
  authGuard,
  requireRole("host"),
  express.json(),
  getPresignedPost
);
router.get("/debug", (req, res) => {
  res.json({
    region: process.env.S3_REGION,
    bucket: process.env.S3_BUCKET,
    akid: (process.env.AWS_ACCESS_KEY_ID || "").slice(0,4) + "***"
  });
});
export default router;
