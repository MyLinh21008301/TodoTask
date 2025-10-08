import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import {
  getHostStatus, applyHost, submitKyc, linkPayoutDev,
  signHostAgreement, adminApproveHost
} from '../controllers/host.controller.js';

const router = express.Router();

// Host onboarding (user)
router.get('/status',          authGuard, getHostStatus);
router.post('/apply',          authGuard, express.json(), applyHost);
router.post('/kyc',            authGuard, express.json(), submitKyc);
router.post('/payout/dev',     authGuard, express.json(), linkPayoutDev);
router.post('/agreement',      authGuard, express.json(), signHostAgreement);

// Admin decision
router.post('/admin/approve',  authGuard, requireRole('admin'), express.json(), adminApproveHost);

export default router;
