// src/routers/auth.routes.js (Đã dọn dẹp)

import express from 'express';
import { 
  register, login, logout, refresh, googleLogin, 
  verifyEmail, resendOtp, forgotPasswordRequest, 
  forgotPasswordVerify, resetPassword 
} from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/register',     register);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp',   resendOtp);
router.post('/login',        login);
router.post('/logout',       logout);
router.post('/refresh',      refresh);
router.post('/google',       googleLogin);  
router.post('/password/forgot/request', forgotPasswordRequest);
router.post('/password/forgot/verify',  forgotPasswordVerify);
router.post('/password/reset',          resetPassword);

export default router;