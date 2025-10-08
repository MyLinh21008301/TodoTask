import crypto from 'crypto';
const SECRET = process.env.EMAIL_OTP_SECRET || 'dev-secret';
export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
export const hashOtp = (code, email) =>
  crypto.createHmac('sha256', SECRET).update(`${email}:${code}`).digest('hex');
