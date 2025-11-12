// src/validators/user.schema.js
import { z } from 'zod';

// Schema để cập nhật thông tin user profile
export const updateUserProfileSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  picture: z.string().url().optional().or(z.literal('')), // Cho phép xóa ảnh
  gender: z.enum(['male', 'female', 'other']).optional(),
  phone: z.string().min(10).max(20).optional().or(z.literal('')), // Cho phép xóa phone
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.date()).optional(), // Format: YYYY-MM-DD
  address: z.object({
    line1: z.string().optional(),
    ward: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional()
  }).optional()
});

// Schema để đổi mật khẩu
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6)
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: "Mật khẩu mới phải khác mật khẩu hiện tại",
  path: ["newPassword"]
});

