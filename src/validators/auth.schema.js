// // src/validators/auth.schema.js
// import { z } from 'zod';

// export const registerSchema = z.object({
//   email: z.string().email(),
//   password: z.string().min(6),
//   first_name: z.string().min(1),
//   last_name: z.string().min(1),
//   gender: z.enum(['male', 'female', 'other'], { message: "Giới tính không hợp lệ" }).optional(),
//   phone: z.string().min(10, { message: "Số điện thoại không hợp lệ" }).optional(),
//   dob: z.string().optional(), 
//   address: z.object({
//       line1: z.string().optional(),
//       ward: z.string().optional(),
//       district: z.string().optional(),
//       city: z.string().optional()
//   }).optional(),
  
//   // === THÊM 2 TRƯỜNG MỚI ===
//   cccdNumber: z.string().regex(/^[0-9]{12}$/, "CCCD phải là 12 chữ số"),
//   picture: z.string().url("Định dạng URL ảnh không hợp lệ").optional().nullable(), // URL ảnh (tùy chọn)
//   // === KẾT THÚC THÊM ===
// });

// export const loginSchema = z.object({
//   email: z.string().email(),
//   password: z.string().min(6)
// });

// export const verifyEmailSchema = z.object({
//   email: z.string().email(),
//   code: z.string().regex(/^\d{6}$/)
// });

// export const resendOtpSchema = z.object({
//   email: z.string().email()
// });

// export const forgotPasswordRequestSchema = z.object({
//   email: z.string().email()
// });

// export const forgotPasswordVerifySchema = z.object({
//   email: z.string().email(),
//   code: z.string().regex(/^\d{6}$/)
// });

// export const resetPasswordSchema = z.object({
//   new_password: z.string().min(6)
// });

// src/validators/auth.schema.js
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  gender: z.enum(['male', 'female', 'other'], { message: "Giới tính không hợp lệ" }).optional(),
  phone: z.string().min(10, { message: "Số điện thoại không hợp lệ" }).optional(),
  dob: z.string().optional(), 
  address: z.object({
      line1: z.string().optional(),
      ward: z.string().optional(),
      district: z.string().optional(),
      city: z.string().optional()
  }).optional(),
  
  cccdNumber: z.string().regex(/^[0-9]{12}$/, "CCCD phải là 12 chữ số"),
  picture: z.string().url("Định dạng URL ảnh không hợp lệ").optional().nullable(), // URL ảnh (tùy chọn)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/)
});

export const resendOtpSchema = z.object({
  email: z.string().email()
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email()
});

export const forgotPasswordVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/)
});

export const resetPasswordSchema = z.object({
  new_password: z.string().min(6)
});