// src/validators/promotion.schema.js
import { z } from 'zod';

export const createPromotionSchema = z.object({
  title: z.string().min(3),
  code: z.string().min(3).regex(/^[A-Za-z0-9_]+$/).transform(val => val.toUpperCase()),
  type: z.enum(['percent', 'amount']),
  value: z.number().min(1),
  minNights: z.number().min(0).optional(),
  dateFrom: z.string().or(z.date()),
  dateTo: z.string().or(z.date()),
  
  // <<< SỬA: Nhận mảng string (ID) >>>
  listingIds: z.array(z.string()).optional() 
});