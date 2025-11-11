// src/routes/notification.routes.js
import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { 
  getMyNotifications, 
  getUnreadCount, 
  markAllAsRead 
} from '../controllers/notification.controller.js';

const r = express.Router();

// Tất cả API này đều yêu cầu đăng nhập
r.use(authGuard);

// GET /api/notifications -> Lấy danh sách
r.get('/', getMyNotifications);

// GET /api/notifications/unread-count -> Chỉ lấy số đếm
r.get('/unread-count', getUnreadCount);

// POST /api/notifications/mark-all-read -> Đánh dấu tất cả đã đọc
r.post('/mark-all-read', markAllAsRead);

export default r;