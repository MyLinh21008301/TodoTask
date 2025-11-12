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

/**
 * Tạo presigned URL để upload file cho chat (image, file, voice)
 */
export const getChatFileUpload = async (req, res, next) => {
  try {
    const { fileName, fileType, messageType = 'file' } = req.body;
    if (!fileName || !fileType) {
      return res.status(400).json({ message: "fileName và fileType là bắt buộc" });
    }

    // Validate messageType
    if (!['image', 'file', 'voice'].includes(messageType)) {
      return res.status(400).json({ message: "messageType phải là image, file hoặc voice" });
    }

    // Tạo key dựa trên messageType
    const folder = messageType === 'image' ? 'chat/images' : 
                   messageType === 'voice' ? 'chat/voice' : 'chat/files';
    const key = `${folder}/${Date.now()}-${fileName.replace(/\s+/g, "-")}`;

    const { url, fields } = await createPresignedPost(s3, {
      Bucket: BUCKET_NAME,
      Key: key,
      Fields: {
        "Content-Type": fileType,
      },
      Conditions: [
        ["content-length-range", 0, 50 * 1024 * 1024], // 50MB max
        ["starts-with", "$Content-Type", ""]
      ],
      Expires: 300,
    });

    // Thêm CORS headers vào presigned POST
    // Note: S3 bucket cũng cần được cấu hình CORS để cho phép upload từ browser

    // Tạo file URL
    const fileUrl = `https://${BUCKET_NAME}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;

    res.json({ 
      url, 
      fields, 
      s3Key: key,
      fileUrl,
      fileRef: {
        bucket: BUCKET_NAME,
        region: process.env.S3_REGION,
        key: key,
        url: fileUrl,
        contentType: fileType
      }
    });
  } catch (err) {
    console.error("Lỗi khi tạo presigned POST cho chat:", err);
    next(err);
  }
};