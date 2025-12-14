// src/validators/booking.schema.js
import { z } from 'zod';

export const createBookingSchema = z.object({
  listingId: z.string().min(1),
  checkinDate: z.string().min(1),  // ISO yyyy-mm-dd
  checkoutDate: z.string().min(1),
  guestCount: z.number().int().min(1).default(1)
});

export const hostDecisionSchema = z.object({
  expiresInMinutes: z.number().int().min(5).max(24*60).default(60)
});

export const initiatePaySchema = z.object({
  provider: z.enum(['payos','vietqr']).default('payos'),
  method: z.enum(['bank_qr','card']).default('bank_qr')
});

export const webhookSchema = z.object({
  code: z.string(), 
  success: z.boolean(),
  data: z.object({
    orderCode: z.coerce.string(), // Tự động chuyển số 176... thành chuỗi "176..."
  }).passthrough(), // Cho phép các trường khác trong 'data'
  signature: z.string()
});
export const cancelBookingSchema = z.object({
  reason: z.string().optional(),
  bankName: z.string().min(1, "Vui lòng nhập tên ngân hàng"),
  accountNumber: z.string().min(1, "Vui lòng nhập số tài khoản"),
  accountHolder: z.string().min(1, "Vui lòng nhập tên chủ tài khoản")
});