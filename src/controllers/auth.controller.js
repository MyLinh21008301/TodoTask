// // src/controllers/auth.controller.js
// import bcrypt from 'bcryptjs';
// import User from '../models/user.model.js';
// import RefreshToken from '../models/refreshToken.model.js';
// import { 
//   registerSchema, 
//   loginSchema, 
//   verifyEmailSchema, 
//   resendOtpSchema, 
//   forgotPasswordRequestSchema,
//   forgotPasswordVerifySchema,
//   resetPasswordSchema 
// } from '../validators/auth.schema.js';
// import { signAccessToken, issueRefreshToken, verifyRefresh, revokeRefreshToken } from '../utils/jwt.js';
// import { verifyGoogleIdToken } from '../utils/google.js';
// import { generateOtp, hashOtp } from '../utils/otp.js';
// import { sendOtpMail, sendResetOtpMail } from '../utils/mailer.js';
// import jwt from 'jsonwebtoken';
// import mongoose from 'mongoose';
// import crypto from 'crypto'; // Cần cho forgotPasswordVerify

// function setRefreshCookie(res, raw) {
//   res.cookie('rt', raw, {
//     httpOnly: true,
//     secure: (process.env.COOKIE_SECURE === 'true'),
//     sameSite: 'lax',
//     path: '/api/auth',
//     maxAge: 1000 * 60 * 60 * 24 * 30,
//     domain: process.env.COOKIE_DOMAIN || undefined
//   });
// }

// export const register = async (req, res, next) => {
//   try {
//     const body = registerSchema.parse(req.body);
//     const email = body.email.toLowerCase();

//     const existed = await User.findOne({ email });
//     if (existed && existed.status !== 'deleted') {
      
//       // Nếu email đã tồn tại nhưng chưa active (pending), cho phép ghi đè
//       if (existed.status === 'pending') {
//          console.log('Email pending, cho phép ghi đè thông tin đăng ký...');
//       } else {
//          return res.status(409).json({ message: 'Email already in use' });
//       }
//     }
    
//     // Kiểm tra CCCD (cho user hoàn toàn mới, hoặc user pending)
//     if (!existed || existed.status === 'pending') {
//        const cccdExists = await User.exists({ cccdNumber: body.cccdNumber, _id: { $ne: existed?._id } });
//        if (cccdExists) {
//          return res.status(409).json({ message: 'Số CCCD đã được sử dụng' });
//        }
//     }

//     const user = existed ?? new User();
    
//     user.email = email;
//     user.first_name = body.first_name;
//     user.last_name = body.last_name;
//     user.phone = body.phone;
//     user.dob = body.dob ? new Date(body.dob) : undefined;
//     user.address = body.address;
//     user.gender = body.gender;

//     // === THÊM 2 TRƯỜNG MỚI ===
//     user.cccdNumber = body.cccdNumber;
//     user.picture = body.picture; // Nhận URL từ frontend
//     // === KẾT THÚC THÊM ===

//     user.roles = ['guest'];
//     user.status = 'pending';
//     user.auth = { local: { enabled: true }, google: existed?.auth?.google || null };
//     await user.setPassword(body.password);

//     // tạo OTP
//     const code = generateOtp();
//     const ttlMin = Number(process.env.EMAIL_OTP_TTL_MIN || 10);
//     user.emailVerification = {
//       codeHash: hashOtp(code, email),
//       expiresAt: new Date(Date.now() + ttlMin * 60 * 1000),
//       attempts: 0,
//       sentCount: (user.emailVerification?.sentCount ?? 0) + 1,
//       lastSentAt: new Date()
//     };

//     await user.save();
//     await sendOtpMail(email, code);

//     return res.status(201).json({ message: 'OTP sent to your email. Please verify.' });
//   } catch (err) { 
//     // Thêm check lỗi unique của Mongoose
//     if (err.code === 11000 && err.keyPattern?.cccdNumber) {
//       return res.status(409).json({ message: 'Số CCCD này đã được đăng ký' });
//     }
//     next(err); 
//   }
// };

// export const verifyEmail = async (req, res, next) => {
//   try {
//     const { email, code } = verifyEmailSchema.parse(req.body);
//     const emailL = email.toLowerCase();
//     const user = await User.findOne({ email: emailL });
//     if (!user) return res.status(404).json({ message: 'User not found' });

//     if (user.status === 'active' && user.emailVerifiedAt) {
//       return res.status(200).json({ message: 'Email already verified' });
//     }

//     const ev = user.emailVerification || {};
//     if (!ev.codeHash || !ev.expiresAt) return res.status(400).json({ message: 'No OTP requested' });
//     if (new Date() > new Date(ev.expiresAt)) return res.status(400).json({ message: 'OTP expired' });
//     if (ev.attempts >= 5) return res.status(429).json({ message: 'Too many attempts. Please resend OTP.' });

//     const ok = ev.codeHash === hashOtp(code, emailL);
//     user.emailVerification.attempts = (ev.attempts || 0) + 1;
//     if (!ok) { await user.save(); return res.status(400).json({ message: 'Invalid OTP code' }); }

//     // đúng OTP -> kích hoạt
//     user.status = 'active';
//     user.emailVerifiedAt = new Date();
//     user.emailVerification = {};
//     await user.save();

//     const access = signAccessToken(user);
//     const { raw: refresh } = await issueRefreshToken(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
//     setRefreshCookie(res, refresh);

//     return res.json({ message: 'Email verified', accessToken: access, user: user.toJSON() });
//   } catch (err) { next(err); }
// };

// export const resendOtp = async (req, res, next) => {
//   try {
//     const { email } = resendOtpSchema.parse(req.body);
//     const emailL = email.toLowerCase();
//     const user = await User.findOne({ email: emailL });
//     if (!user) return res.status(404).json({ message: 'User not found' });
//     if (user.status === 'active' && user.emailVerifiedAt) {
//       return res.status(200).json({ message: 'Email already verified' });
//     }

//     const cooldownSec = Number(process.env.EMAIL_OTP_RESEND_COOLDOWN || 60);
//     const now = Date.now();
//     const last = user.emailVerification?.lastSentAt ? new Date(user.emailVerification.lastSentAt).getTime() : 0;
//     if (now - last < cooldownSec * 1000) {
//       return res.status(429).json({ message: `Please wait ${cooldownSec}s before requesting another OTP.` });
//     }

//     const code = generateOtp();
//     const ttlMin = Number(process.env.EMAIL_OTP_TTL_MIN || 10);
//     user.emailVerification = {
//       codeHash: hashOtp(code, emailL),
//       expiresAt: new Date(now + ttlMin * 60 * 1000),
//       attempts: 0,
//       sentCount: (user.emailVerification?.sentCount ?? 0) + 1,
//       lastSentAt: new Date()
//     };
//     await user.save();
//     await sendOtpMail(emailL, code);

//     return res.json({ message: 'OTP re-sent to your email' });
//   } catch (err) { next(err); }
// };

// export const login = async (req, res, next) => {
//   try {
//     const { email, password } = loginSchema.parse(req.body);
//     const user = await User.findOne({ email: email.toLowerCase() });
//     if (!user) return res.status(400).json({ message: 'Invalid email or password' });

//     const ok = await user.comparePassword(password);
//     if (!ok) return res.status(400).json({ message: 'Invalid email or password' });
//     if (user.status !== 'active') return res.status(403).json({ message: 'Account is not active' });

//     user.lastLoginAt = new Date();
//     user.lastLoginIp = req.ip;
//     await user.save();

//     const access = signAccessToken(user);
//     const { raw: refresh } = await issueRefreshToken(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
//     setRefreshCookie(res, refresh);

//     res.json({ accessToken: access, user: user.toJSON() });
//   } catch (err) { next(err); }
// };

// export const logout = async (req, res, next) => {
//   try {
//     const rt = req.cookies?.rt;
//     if (rt) await revokeRefreshToken(rt);
//     res.clearCookie('rt', { path: '/api/auth', domain: process.env.COOKIE_DOMAIN || undefined });
//     res.json({ message: 'Logged out' });
//   } catch (err) { next(err); }
// };

// export const refresh = async (req, res, next) => {
//   try {
//     const rt = req.cookies?.rt;
//     if (!rt) return res.status(401).json({ message: 'No refresh token' });

//     const payload = verifyRefresh(rt);
//     const tokenHash = crypto.createHash('sha256').update(rt).digest('hex');

//     const doc = await RefreshToken.findOne({ tokenHash, revokedAt: { $exists: false } });
//     if (!doc || String(doc.user) !== payload.sub) return res.status(401).json({ message: 'Invalid refresh token' });

//     const user = await User.findById(payload.sub);
//     if (!user) return res.status(401).json({ message: 'User not found' });

//     const access = signAccessToken(user);
//     res.json({ accessToken: access });
//   } catch (err) {
//     return res.status(401).json({ message: 'Invalid refresh token' });
//   }
// };

// /** ========== GOOGLE LOGIN (giữ nguyên) ========== */
// export const googleLogin = async (req, res, next) => {
//   try {
//     const { idToken } = req.body || {};
//     if (!idToken) return res.status(400).json({ message: 'Missing idToken' });

//     const p = await verifyGoogleIdToken(idToken);
//     if (!p?.email) return res.status(400).json({ message: 'Google token has no email' });
//     if (p.aud !== process.env.GOOGLE_CLIENT_ID) return res.status(400).json({ message: 'Invalid audience for Google token' });

//     const email = String(p.email).toLowerCase();
//     let user = await User.findOne({ email });

//     if (!user) {
//       user = await User.create({
//         email,
//         emailVerifiedAt: p.email_verified ? new Date() : undefined,
//         first_name: p.given_name || undefined,
//         last_name:  p.family_name || undefined,
//         picture:    p.picture || undefined,
//         roles: ['guest'],
//         status: 'active',
//         auth: { local: { enabled: false }, google: { id: p.sub, email, picture: p.picture || undefined, linkedAt: new Date() } }
//       });
//     } else {
//       if (!user.auth) user.auth = { local: { enabled: !!user.passwordHash }, google: {} };
//       if (!user.auth.google || !user.auth.google.id) {
//         user.auth.google = { id: p.sub, email, picture: p.picture || user.picture, linkedAt: new Date() };
//       }
//       if (p.email_verified && !user.emailVerifiedAt) user.emailVerifiedAt = new Date();
//       if (!user.picture && p.picture) user.picture = p.picture;
//       user.lastLoginAt = new Date();
//       user.lastLoginIp = req.ip;
//       await user.save();
//     }

//     const access = signAccessToken(user);
//     const { raw: refresh } = await issueRefreshToken(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
//     setRefreshCookie(res, refresh);

//     res.json({ accessToken: access, user: user.toJSON() });
//   } catch (err) { next(err); }
// };

// export const forgotPasswordRequest = async (req, res, next) => {
//   try {
//     const { email } = forgotPasswordRequestSchema.parse(req.body);
//     const emailL = email.toLowerCase();
//     const user = await User.findOne({ email: emailL });

//     const cooldownSec = Number(process.env.EMAIL_OTP_RESEND_COOLDOWN || 60);
//     const ttlMin = Number(process.env.EMAIL_OTP_TTL_MIN || 10);
//     const now = Date.now();

//     if (!user) {
//       return res.json({ message: 'If this email exists, an OTP has been sent.' });
//     }

//     const last = user.passwordReset?.lastSentAt ? new Date(user.passwordReset.lastSentAt).getTime() : 0;
//     if (now - last < cooldownSec * 1000) {
//       return res.status(429).json({ message: `Please wait ${cooldownSec}s before requesting another OTP.` });
//     }

//     const code = generateOtp();
//     user.passwordReset = {
//       codeHash: hashOtp(code, emailL),
//       expiresAt: new Date(now + ttlMin * 60 * 1000),
//       attempts: 0,
//       sentCount: (user.passwordReset?.sentCount ?? 0) + 1,
//       lastSentAt: new Date(),
//       verifiedAt: undefined,
//       sessionJti: undefined,
//       sessionExpiresAt: undefined
//     };

//     await user.save();
//     await sendResetOtpMail(emailL, code);

//     return res.json({ message: 'If this email exists, an OTP has been sent.' });
//   } catch (err) { next(err); }
// };

// export const forgotPasswordVerify = async (req, res, next) => {
//   try {
//     const { email, code } = forgotPasswordVerifySchema.parse(req.body);
//     const emailL = email.toLowerCase();
//     const user = await User.findOne({ email: emailL });
//     if (!user) return res.status(400).json({ message: 'Invalid OTP or expired' });

//     const pr = user.passwordReset || {};
//     if (!pr.codeHash || !pr.expiresAt) return res.status(400).json({ message: 'Invalid OTP or expired' });
//     if (new Date() > new Date(pr.expiresAt)) return res.status(400).json({ message: 'Invalid OTP or expired' });
//     if (pr.attempts >= 5) return res.status(429).json({ message: 'Too many attempts' });

//     const ok = pr.codeHash === hashOtp(code, emailL);
//     user.passwordReset.attempts = (pr.attempts || 0) + 1;
//     if (!ok) { await user.save(); return res.status(400).json({ message: 'Invalid OTP or expired' }); }

//     const RESET_SECRET = process.env.JWT_RESET_SECRET;
//     const RESET_TTL = process.env.RESET_SESSION_TTL || '15m';
//     const jti = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
//     const token = jwt.sign({ sub: String(user._id), jti }, RESET_SECRET, { expiresIn: RESET_TTL });

//     const payload = jwt.decode(token);
//     user.passwordReset.verifiedAt = new Date();
//     user.passwordReset.sessionJti = jti;
//     user.passwordReset.sessionExpiresAt = new Date(payload.exp * 1000);
//     await user.save();

//     return res.json({ resetToken: token, message: 'OTP verified. You can now reset your password.' });
//   } catch (err) { next(err); }
// };

// export const resetPassword = async (req, res, next) => {
//   try {
//     const { new_password } = resetPasswordSchema.parse(req.body);
//     const header = req.headers.authorization || '';
//     const raw = header.startsWith('Bearer ') ? header.slice(7) : null;

//     console.log("--- Yêu cầu Reset Mật khẩu ---");
//     console.log("Header Authorization:", header);
//     console.log("Token được trích xuất (raw):", raw);

//     if (!raw) return res.status(401).json({ message: 'Missing reset token' });

//     const RESET_SECRET = process.env.JWT_RESET_SECRET;

//     console.log("Đang dùng RESET_SECRET:", RESET_SECRET ? RESET_SECRET.substring(0, 5) + '...' : 'KHÔNG TÌM THẤY SECRET!');

//     let payload;
//     try {
//       payload = jwt.verify(raw, RESET_SECRET);
     
//       console.log("Xác thực token thành công. Payload:", payload);
//     } catch (err) { 
//       console.error("!!! LỖI XÁC THỰC TOKEN:", err.message);
//       console.error("Chi tiết token (đã giải mã):", jwt.decode(raw)); 
//       return res.status(401).json({ message: 'Invalid reset token' });
//     }

//     const user = await User.findById(payload.sub);
  
//     console.log("Tìm thấy user:", user ? user.email : 'Không tìm thấy user');
//     console.log("Session JTI đã lưu:", user?.passwordReset?.sessionJti);
//     console.log("Token JTI:", payload?.jti);
//     console.log("Session hết hạn lúc:", user?.passwordReset?.sessionExpiresAt);

//     if (!user || !user.passwordReset?.sessionJti) {
//       console.log("Lý do từ chối: Không tìm thấy user hoặc không có session JTI được lưu.");
//       return res.status(401).json({ message: 'Invalid reset session (no JTI)' });
//     }
//     if (user.passwordReset.sessionJti !== payload.jti) {
//        console.log("Lý do từ chối: JTI không khớp.");
//       return res.status(401).json({ message: 'Invalid reset session (JTI mismatch)' });
//     }
//     if (new Date() > new Date(user.passwordReset.sessionExpiresAt)) {
//       console.log("Lý do từ chối: Session đã hết hạn.");
//       return res.status(401).json({ message: 'Reset session expired' });
//     }

//     await user.setPassword(new_password);
//     user.passwordReset = {};
//     await user.save();
//     console.log("Đặt lại mật khẩu thành công cho:", user.email);

//     await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });

//     return res.json({ message: 'Password has been updated. Please log in again.' });
//   } catch (err) {
//     console.error("Lỗi trong hàm resetPassword:", err);
//     next(err);
//   }
// };


// src/controllers/auth.controller.js
import bcrypt from 'bcryptjs';
import User from '../models/user.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import { 
  registerSchema, 
  loginSchema, 
  verifyEmailSchema, 
  resendOtpSchema, 
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  resetPasswordSchema 
} from '../validators/auth.schema.js';
import { signAccessToken, issueRefreshToken, verifyRefresh, revokeRefreshToken } from '../utils/jwt.js';
import { verifyGoogleIdToken } from '../utils/google.js';
import { generateOtp, hashOtp } from '../utils/otp.js';
import { sendOtpMail, sendResetOtpMail } from '../utils/mailer.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import crypto from 'crypto';

function setRefreshCookie(res, raw) {
  res.cookie('rt', raw, {
    httpOnly: true,
    secure: (process.env.COOKIE_SECURE === 'true'),
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 1000 * 60 * 60 * 24 * 30,
    domain: process.env.COOKIE_DOMAIN || undefined
  });
}

export const register = async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);
    const email = body.email.toLowerCase();

    const existed = await User.findOne({ email });
    if (existed && existed.status !== 'deleted') {
      
      // Nếu email đã tồn tại nhưng chưa active (pending), cho phép ghi đè
      if (existed.status === 'pending') {
         console.log('Email pending, cho phép ghi đè thông tin đăng ký...');
      } else {
         return res.status(409).json({ message: 'Email này đã được sử dụng' });
      }
    }
    
    // Kiểm tra CCCD (cho user hoàn toàn mới, hoặc user pending)
    if (!existed || existed.status === 'pending') {
       const cccdExists = await User.exists({ cccdNumber: body.cccdNumber, _id: { $ne: existed?._id } });
       if (cccdExists) {
         return res.status(409).json({ message: 'Số CCCD này đã được sử dụng' });
       }
    }
    
    // === THÊM: KIỂM TRA SĐT TRÙNG LẶP ===
    if (body.phone && (!existed || existed.status === 'pending')) {
      const phoneExists = await User.exists({ phone: body.phone, _id: { $ne: existed?._id } });
      if (phoneExists) {
        return res.status(409).json({ message: 'Số điện thoại này đã được sử dụng' });
      }
    }
    // === KẾT THÚC THÊM ===

    const user = existed ?? new User();
    
    user.email = email;
    user.first_name = body.first_name;
    user.last_name = body.last_name;
    user.phone = body.phone;
    user.dob = body.dob ? new Date(body.dob) : undefined;
    user.address = body.address;
    user.gender = body.gender;
    user.cccdNumber = body.cccdNumber;
    user.picture = body.picture; // Nhận URL từ frontend

    user.roles = ['guest'];
    user.status = 'pending';
    user.auth = { local: { enabled: true }, google: existed?.auth?.google || null };
    await user.setPassword(body.password);

    // tạo OTP
    const code = generateOtp();
    const ttlMin = Number(process.env.EMAIL_OTP_TTL_MIN || 10);
    user.emailVerification = {
      codeHash: hashOtp(code, email),
      expiresAt: new Date(Date.now() + ttlMin * 60 * 1000),
      attempts: 0,
      sentCount: (user.emailVerification?.sentCount ?? 0) + 1,
      lastSentAt: new Date()
    };

    await user.save();
    await sendOtpMail(email, code);

    return res.status(201).json({ message: 'OTP sent to your email. Please verify.' });
  } catch (err) { 
    // Thêm check lỗi unique của Mongoose (cho cả phone và cccd)
    if (err.code === 11000) {
      if (err.keyPattern?.cccdNumber) {
        return res.status(409).json({ message: 'Số CCCD này đã được đăng ký' });
      }
      if (err.keyPattern?.phone) {
        return res.status(409).json({ message: 'Số điện thoại này đã được đăng ký' });
      }
    }
    next(err); 
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { email, code } = verifyEmailSchema.parse(req.body);
    const emailL = email.toLowerCase();
    const user = await User.findOne({ email: emailL });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.status === 'active' && user.emailVerifiedAt) {
      return res.status(200).json({ message: 'Email already verified' });
    }

    const ev = user.emailVerification || {};
    if (!ev.codeHash || !ev.expiresAt) return res.status(400).json({ message: 'No OTP requested' });
    if (new Date() > new Date(ev.expiresAt)) return res.status(400).json({ message: 'OTP expired' });
    if (ev.attempts >= 5) return res.status(429).json({ message: 'Too many attempts. Please resend OTP.' });

    const ok = ev.codeHash === hashOtp(code, emailL);
    user.emailVerification.attempts = (ev.attempts || 0) + 1;
    if (!ok) { await user.save(); return res.status(400).json({ message: 'Invalid OTP code' }); }

    // đúng OTP -> kích hoạt
    user.status = 'active';
    user.emailVerifiedAt = new Date();
    user.emailVerification = {};
    await user.save();

    const access = signAccessToken(user);
    const { raw: refresh } = await issueRefreshToken(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
    setRefreshCookie(res, refresh);

    return res.json({ message: 'Email verified', accessToken: access, user: user.toJSON() });
  } catch (err) { next(err); }
};

export const resendOtp = async (req, res, next) => {
  try {
    const { email } = resendOtpSchema.parse(req.body);
    const emailL = email.toLowerCase();
    const user = await User.findOne({ email: emailL });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.status === 'active' && user.emailVerifiedAt) {
      return res.status(200).json({ message: 'Email already verified' });
    }

    const cooldownSec = Number(process.env.EMAIL_OTP_RESEND_COOLDOWN || 60);
    const now = Date.now();
    const last = user.emailVerification?.lastSentAt ? new Date(user.emailVerification.lastSentAt).getTime() : 0;
    if (now - last < cooldownSec * 1000) {
      return res.status(429).json({ message: `Please wait ${cooldownSec}s before requesting another OTP.` });
    }

    const code = generateOtp();
    const ttlMin = Number(process.env.EMAIL_OTP_TTL_MIN || 10);
    user.emailVerification = {
      codeHash: hashOtp(code, emailL),
      expiresAt: new Date(now + ttlMin * 60 * 1000),
      attempts: 0,
      sentCount: (user.emailVerification?.sentCount ?? 0) + 1,
      lastSentAt: new Date()
    };
    await user.save();
    await sendOtpMail(emailL, code);

    return res.json({ message: 'OTP re-sent to your email' });
  } catch (err) { next(err); }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid email or password' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ message: 'Invalid email or password' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Account is not active' });

    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();

    const access = signAccessToken(user);
    const { raw: refresh } = await issueRefreshToken(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
    setRefreshCookie(res, refresh);

    res.json({ accessToken: access, user: user.toJSON() });
  } catch (err) { next(err); }
};

export const logout = async (req, res, next) => {
  try {
    const rt = req.cookies?.rt;
    if (rt) await revokeRefreshToken(rt);
    res.clearCookie('rt', { path: '/api/auth', domain: process.env.COOKIE_DOMAIN || undefined });
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
};

export const refresh = async (req, res, next) => {
  try {
    const rt = req.cookies?.rt;
    if (!rt) return res.status(401).json({ message: 'No refresh token' });

    const payload = verifyRefresh(rt);
    const tokenHash = crypto.createHash('sha256').update(rt).digest('hex');

    const doc = await RefreshToken.findOne({ tokenHash, revokedAt: { $exists: false } });
    if (!doc || String(doc.user) !== payload.sub) return res.status(401).json({ message: 'Invalid refresh token' });

    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'User not found' });

    const access = signAccessToken(user);
    res.json({ accessToken: access });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ message: 'Missing idToken' });

    const p = await verifyGoogleIdToken(idToken);
    if (!p?.email) return res.status(400).json({ message: 'Google token has no email' });
    if (p.aud !== process.env.GOOGLE_CLIENT_ID) return res.status(400).json({ message: 'Invalid audience for Google token' });

    const email = String(p.email).toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        email,
        emailVerifiedAt: p.email_verified ? new Date() : undefined,
        first_name: p.given_name || undefined,
        last_name:  p.family_name || undefined,
        picture:    p.picture || undefined,
        roles: ['guest'],
        status: 'active',
        auth: { local: { enabled: false }, google: { id: p.sub, email, picture: p.picture || undefined, linkedAt: new Date() } }
      });
    } else {
      if (!user.auth) user.auth = { local: { enabled: !!user.passwordHash }, google: {} };
      if (!user.auth.google || !user.auth.google.id) {
        user.auth.google = { id: p.sub, email, picture: p.picture || user.picture, linkedAt: new Date() };
      }
      if (p.email_verified && !user.emailVerifiedAt) user.emailVerifiedAt = new Date();
      if (!user.picture && p.picture) user.picture = p.picture;
      user.lastLoginAt = new Date();
      user.lastLoginIp = req.ip;
      await user.save();
    }

    const access = signAccessToken(user);
    const { raw: refresh } = await issueRefreshToken(user, { ip: req.ip, userAgent: req.headers['user-agent'] });
    setRefreshCookie(res, refresh);

    res.json({ accessToken: access, user: user.toJSON() });
  } catch (err) { next(err); }
};

export const forgotPasswordRequest = async (req, res, next) => {
  try {
    const { email } = forgotPasswordRequestSchema.parse(req.body);
    const emailL = email.toLowerCase();
    const user = await User.findOne({ email: emailL });

    const cooldownSec = Number(process.env.EMAIL_OTP_RESEND_COOLDOWN || 60);
    const ttlMin = Number(process.env.EMAIL_OTP_TTL_MIN || 10);
    const now = Date.now();

    if (!user) {
      return res.json({ message: 'If this email exists, an OTP has been sent.' });
    }

    const last = user.passwordReset?.lastSentAt ? new Date(user.passwordReset.lastSentAt).getTime() : 0;
    if (now - last < cooldownSec * 1000) {
      return res.status(429).json({ message: `Please wait ${cooldownSec}s before requesting another OTP.` });
    }

    const code = generateOtp();
    user.passwordReset = {
      codeHash: hashOtp(code, emailL),
      expiresAt: new Date(now + ttlMin * 60 * 1000),
      attempts: 0,
      sentCount: (user.passwordReset?.sentCount ?? 0) + 1,
      lastSentAt: new Date(),
      verifiedAt: undefined,
      sessionJti: undefined,
      sessionExpiresAt: undefined
    };

    await user.save();
    await sendResetOtpMail(emailL, code);

    return res.json({ message: 'If this email exists, an OTP has been sent.' });
  } catch (err) { next(err); }
};

export const forgotPasswordVerify = async (req, res, next) => {
  try {
    const { email, code } = forgotPasswordVerifySchema.parse(req.body);
    const emailL = email.toLowerCase();
    const user = await User.findOne({ email: emailL });
    if (!user) return res.status(400).json({ message: 'Invalid OTP or expired' });

    const pr = user.passwordReset || {};
    if (!pr.codeHash || !pr.expiresAt) return res.status(400).json({ message: 'Invalid OTP or expired' });
    if (new Date() > new Date(pr.expiresAt)) return res.status(400).json({ message: 'Invalid OTP or expired' });
    if (pr.attempts >= 5) return res.status(429).json({ message: 'Too many attempts' });

    const ok = pr.codeHash === hashOtp(code, emailL);
    user.passwordReset.attempts = (pr.attempts || 0) + 1;
    if (!ok) { await user.save(); return res.status(400).json({ message: 'Invalid OTP or expired' }); }

    const RESET_SECRET = process.env.JWT_RESET_SECRET;
    const RESET_TTL = process.env.RESET_SESSION_TTL || '15m';
    const jti = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    const token = jwt.sign({ sub: String(user._id), jti }, RESET_SECRET, { expiresIn: RESET_TTL });

    const payload = jwt.decode(token);
    user.passwordReset.verifiedAt = new Date();
    user.passwordReset.sessionJti = jti;
    user.passwordReset.sessionExpiresAt = new Date(payload.exp * 1000);
    await user.save();

    return res.json({ resetToken: token, message: 'OTP verified. You can now reset your password.' });
  } catch (err) { next(err); }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { new_password } = resetPasswordSchema.parse(req.body);
    const header = req.headers.authorization || '';
    const raw = header.startsWith('Bearer ') ? header.slice(7) : null;

    console.log("--- Yêu cầu Reset Mật khẩu ---");
    console.log("Header Authorization:", header);
    console.log("Token được trích xuất (raw):", raw);

    if (!raw) return res.status(401).json({ message: 'Missing reset token' });

    const RESET_SECRET = process.env.JWT_RESET_SECRET;

    console.log("Đang dùng RESET_SECRET:", RESET_SECRET ? RESET_SECRET.substring(0, 5) + '...' : 'KHÔNG TÌM THẤY SECRET!');

    let payload;
    try {
      payload = jwt.verify(raw, RESET_SECRET);
     
      console.log("Xác thực token thành công. Payload:", payload);
    } catch (err) { 
      console.error("!!! LỖI XÁC THỰC TOKEN:", err.message);
      console.error("Chi tiết token (đã giải mã):", jwt.decode(raw)); 
      return res.status(401).json({ message: 'Invalid reset token' });
    }

    const user = await User.findById(payload.sub);
  
    console.log("Tìm thấy user:", user ? user.email : 'Không tìm thấy user');
    console.log("Session JTI đã lưu:", user?.passwordReset?.sessionJti);
    console.log("Token JTI:", payload?.jti);
    console.log("Session hết hạn lúc:", user?.passwordReset?.sessionExpiresAt);

    if (!user || !user.passwordReset?.sessionJti) {
      console.log("Lý do từ chối: Không tìm thấy user hoặc không có session JTI được lưu.");
      return res.status(401).json({ message: 'Invalid reset session (no JTI)' });
    }
    if (user.passwordReset.sessionJti !== payload.jti) {
       console.log("Lý do từ chối: JTI không khớp.");
      return res.status(401).json({ message: 'Invalid reset session (JTI mismatch)' });
    }
    if (new Date() > new Date(user.passwordReset.sessionExpiresAt)) {
      console.log("Lý do từ chối: Session đã hết hạn.");
      return res.status(401).json({ message: 'Reset session expired' });
    }

    await user.setPassword(new_password);
    user.passwordReset = {};
    await user.save();
    console.log("Đặt lại mật khẩu thành công cho:", user.email);

    await RefreshToken.updateMany({ user: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });

    return res.json({ message: 'Password has been updated. Please log in again.' });
  } catch (err) {
    console.error("Lỗi trong hàm resetPassword:", err);
    next(err);
  }
};