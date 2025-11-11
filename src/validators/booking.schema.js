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
  intentId: z.string().optional(),
  orderCode: z.string().optional(),
  status: z.enum(['succeeded','failed','refunded']),
  providerTxnId: z.string().optional()
});
