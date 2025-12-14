// src/routers/host.routes.js
import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import {
  getHostStatus,
  submitHostOnboarding, 
  getMyPayoutStats
} from '../controllers/host.controller.js';


const router = express.Router();

router.get('/status', authGuard, getHostStatus);

router.post(
  '/onboarding',
  authGuard,
  express.json({ limit: '5mb' }), 
  submitHostOnboarding
);

router.get('/my-stats', authGuard, requireRole('host'), getMyPayoutStats);

export default router;