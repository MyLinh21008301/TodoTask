// src/routers/host.routes.js
import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import {
  getHostStatus,
  adminApproveHost,
  submitHostOnboarding // <-- Import hàm MỚI
} from '../controllers/host.controller.js';

const router = express.Router();

router.get('/status', authGuard, getHostStatus);

router.post(
  '/onboarding',
  authGuard,
  express.json({ limit: '5mb' }), 
  submitHostOnboarding
);


// Admin decision
router.post('/admin/approve',  authGuard, requireRole('admin'), express.json(), adminApproveHost);

export default router;