// src/routers/auth.routes.js
import express from 'express';
import cookieParser from 'cookie-parser';
import { register, login, logout, refresh, googleLogin, verifyEmail, resendOtp,forgotPasswordRequest, forgotPasswordVerify, resetPassword } from '../controllers/auth.controller.js';

const router = express.Router();

router.use(cookieParser());         
router.post('/register',     express.json(), register);
router.post('/verify-email', express.json(), verifyEmail);
router.post('/resend-otp',   express.json(), resendOtp);
router.post('/login',        express.json(), login);
router.post('/logout',       logout);
router.post('/refresh',      refresh);
router.post('/google',       express.json(), googleLogin);  
router.post('/password/forgot/request', express.json(), forgotPasswordRequest);
router.post('/password/forgot/verify',  express.json(), forgotPasswordVerify);
router.post('/password/reset',          express.json(), resetPassword);

export default router;
