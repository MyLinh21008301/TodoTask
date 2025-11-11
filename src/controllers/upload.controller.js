// src/controllers/upload.controller.js (BACKEND)
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { s3 } from "../config/s3.js";

const BUCKET_NAME = process.env.S3_BUCKET;

// Thêm kiểm tra Bucket ngay khi file được load
if (!BUCKET_NAME) {
    console.error("====== LỖI BIẾN MÔI TRƯỜNG S3 ======");
    console.error("Biến S3_BUCKET bị thiếu. Hãy kiểm tra file .env và KHỞI ĐỘNG LẠI server.");
    console.error("======================================");
    throw new Error("S3_BUCKET env variable is missing.");
}

export const getPresignedPost = async (req, res, next) => {
  try {
    const { fileName, fileType } = req.body;
    if (!fileName || !fileType) {
      return res.status(400).json({ message: "fileName và fileType là bắt buộc" });
    }

    const key = `images/${Date.now()}-${fileName.replace(/\s+/g, "-")}`;

    const { url, fields } = await createPresignedPost(s3, {
      Bucket: BUCKET_NAME,
      Key: key,
      Fields: {
        "Content-Type": fileType,
      },
      Conditions: [
        ["content-length-range", 0, 10 * 1024 * 1024],
        ["starts-with", "$Content-Type", ""]
      ],
      Expires: 300,
    });

    res.json({ url, fields, s3Key: key });
  } catch (err) {
    console.error("Lỗi khi tạo presigned POST:", err);
    next(err);
  }
};