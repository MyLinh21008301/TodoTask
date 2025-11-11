//src/config/s3.js
import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.S3_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// Kiểm tra ngay lúc khởi động
if (!region || !accessKeyId || !secretAccessKey) {
  console.error("====== LỖI BIẾN MÔI TRƯỜNG S3 ======");
  console.error("Một trong các biến S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY bị thiếu.");
  console.error("Hãy kiểm tra file .env và KHỞI ĐỘNG LẠI server backend.");
  console.error("======================================");
  // Dừng ứng dụng nếu thiếu key
  throw new Error("S3 env variables are missing.");
}

console.log("=========================================");
console.log("[S3 Config] KEY ID ĐƯỢC NẠP LÀ:", accessKeyId);
console.log("=========================================");
export const s3 = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey
  }
});
