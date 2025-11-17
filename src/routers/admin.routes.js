// src/routes/admin.routes.js
import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import {
  getAdminDashboardCounts,
  listHostApplications,
  listListingsForModeration
} from '../controllers/admin.controller.js';

const router = express.Router();

// Tất cả API Admin đều yêu cầu đăng nhập VÀ có role 'admin'
router.use(authGuard, requireRole('admin'));

// API lấy số đếm cho sidebar
router.get('/dashboard-counts', getAdminDashboardCounts);

// API lấy danh sách Host đang chờ
router.get('/host-applications', listHostApplications);

// API lấy danh sách Listing đang chờ
router.get('/listings-moderation', express.json(), listListingsForModeration);

export default router;