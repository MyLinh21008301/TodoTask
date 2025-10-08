// src/validators/auth.schema.js
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string().min(1),
  last_name: z.string().min(1)
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