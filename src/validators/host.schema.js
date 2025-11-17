// // src/validators/host.schema.js
// import { z } from 'zod';

// export const hostApplySchema = z.object({}); // không cần body

// export const hostKycSchema = z.object({
//   fullName: z.string().min(1),
//   dob: z.string().min(4), // "yyyy-mm-dd" (đơn giản)
//   address: z.object({
//     country: z.string().min(1),
//     city: z.string().min(1),
//     line1: z.string().min(1),
//     postalCode: z.string().optional()
//   }),
//   // fileRef đã upload trước, FE gửi metadata sang
//   idFront: z.object({
//     bucket: z.string().optional(), region: z.string().optional(),
//     key: z.string().optional(), url: z.string().url(),
//     contentType: z.string().optional(), size: z.number().optional(),
//     width: z.number().optional(), height: z.number().optional()
//   }),
//   idBack: z.object({
//     bucket: z.string().optional(), region: z.string().optional(),
//     key: z.string().optional(), url: z.string().url(),
//     contentType: z.string().optional(), size: z.number().optional(),
//     width: z.number().optional(), height: z.number().optional()
//   })
// });

// export const hostPayoutDevSchema = z.object({
//   bankName: z.string().min(1),
//   accountHolder: z.string().min(1),
//   accountNumberMasked: z.string().min(4) // ví dụ "****1234"
// });

// export const hostAgreementSchema = z.object({
//   signature: z.object({
//     image: z.object({ url: z.string().url() }).optional(),
//     strokesJson: z.string().optional(),
//     consent: z.object({
//       policyKey: z.string().min(1),
//       policyVersion: z.string().min(1),
//       policyHash: z.string().min(1),
//       acceptedAt: z.string().optional()
//     }),
//     ip: z.string().optional(),
//     userAgent: z.string().optional(),
//     device: z.string().optional()
//   })
// });

// export const adminApproveHostSchema = z.object({
//   userId: z.string().min(1),
//   approve: z.boolean(),
//   reason: z.string().optional()
// });


// src/validators/host.schema.js
import { z } from 'zod';

// Giữ lại schema này vì nó đơn giản và có thể dùng để khởi tạo
export const hostApplySchema = z.object({}); // không cần body

// === BẮT ĐẦU SCHEMA MỚI ===

// Schema cho chữ ký (tách ra để dùng chung)
const signaturePayloadSchema = z.object({
  // URL Data (base64) của ảnh chữ ký từ frontend
  image: z.string().startsWith('data:image/png;base64,', "Chữ ký không hợp lệ"), 
  
  // Thông tin đồng ý
  consent: z.object({
    policyKey: z.string().min(1),
    policyVersion: z.string().min(1),
  }),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
});

// Schema MỚI cho toàn bộ flow đăng ký đơn giản
export const simpleHostOnboardingSchema = z.object({
  // Thông tin cá nhân (KYC đơn giản)
  fullName: z.string().min(3, "Họ tên là bắt buộc"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Định dạng ngày sinh phải là YYYY-MM-DD"),
  // Yêu cầu 12 chữ số cho CCCD
  cccdNumber: z.string().regex(/^[0-9]{12}$/, "CCCD phải là 12 chữ số"), 

  // Thông tin thanh toán (Payout)
  bankName: z.string().min(1, "Tên ngân hàng là bắt buộc"),
  accountHolder: z.string().min(1, "Tên chủ tài khoản là bắt buộc"),
  accountNumber: z.string().regex(/^[0-9]+$/, "Số tài khoản chỉ được chứa số"),

  // Chữ ký
  signature: signaturePayloadSchema,
});
// === KẾT THÚC SCHEMA MỚI ===


// Giữ lại schema của Admin
export const adminApproveHostSchema = z.object({
  userId: z.string().min(1),
  approve: z.boolean(),
  reason: z.string().optional()
});

// === CÁC SCHEMA CŨ (hostKycSchema, hostPayoutDevSchema, hostAgreementSchema) ĐÃ BỊ LOẠI BỎ ===
// Chúng không còn cần thiết cho luồng đăng ký đơn giản mới