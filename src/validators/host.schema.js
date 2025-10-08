// src/validators/host.schema.js
import { z } from 'zod';

export const hostApplySchema = z.object({}); // không cần body

export const hostKycSchema = z.object({
  fullName: z.string().min(1),
  dob: z.string().min(4), // "yyyy-mm-dd" (đơn giản)
  address: z.object({
    country: z.string().min(1),
    city: z.string().min(1),
    line1: z.string().min(1),
    postalCode: z.string().optional()
  }),
  // fileRef đã upload trước, FE gửi metadata sang
  idFront: z.object({
    bucket: z.string().optional(), region: z.string().optional(),
    key: z.string().optional(), url: z.string().url(),
    contentType: z.string().optional(), size: z.number().optional(),
    width: z.number().optional(), height: z.number().optional()
  }),
  idBack: z.object({
    bucket: z.string().optional(), region: z.string().optional(),
    key: z.string().optional(), url: z.string().url(),
    contentType: z.string().optional(), size: z.number().optional(),
    width: z.number().optional(), height: z.number().optional()
  })
});

export const hostPayoutDevSchema = z.object({
  bankName: z.string().min(1),
  accountHolder: z.string().min(1),
  accountNumberMasked: z.string().min(4) // ví dụ "****1234"
});

export const hostAgreementSchema = z.object({
  signature: z.object({
    image: z.object({ url: z.string().url() }).optional(),
    strokesJson: z.string().optional(),
    consent: z.object({
      policyKey: z.string().min(1),
      policyVersion: z.string().min(1),
      policyHash: z.string().min(1),
      acceptedAt: z.string().optional()
    }),
    ip: z.string().optional(),
    userAgent: z.string().optional(),
    device: z.string().optional()
  })
});

export const adminApproveHostSchema = z.object({
  userId: z.string().min(1),
  approve: z.boolean(),
  reason: z.string().optional()
});
