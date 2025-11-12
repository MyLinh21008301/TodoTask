import express from 'express';
import { authGuard } from '../middlewares/auth.js';
import {
  getConversationMessages,
  getMessages,
  markAsRead,
  markConversationAllAsRead,
  markAllAsRead,
  getUnreadCount,
  getUnreadCountByConversation,
  getUnreadCountByBooking,
  getConversations,
  getAvailableUsers
} from '../controllers/chat.controller.js';

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authGuard);

// Lấy danh sách conversations (chỉ người đã nhắn tin)
router.get('/conversations', getConversations);

// Lấy danh sách users có thể chat (để chọn và bắt đầu chat mới)
router.get('/users/available', getAvailableUsers);

// Lấy tin nhắn của một conversation (không cần booking)
router.get('/conversations/:receiverId/messages', getConversationMessages);

// Lấy tin nhắn của một booking (backward compatibility)
router.get('/bookings/:bookingId/messages', getMessages);

// Đánh dấu một tin nhắn đã đọc
router.patch('/messages/:messageId/read', markAsRead);

// Đánh dấu tất cả tin nhắn của một conversation đã đọc
router.patch('/conversations/:receiverId/messages/read-all', markConversationAllAsRead);

// Đánh dấu tất cả tin nhắn của một booking đã đọc (backward compatibility)
router.patch('/bookings/:bookingId/messages/read-all', markAllAsRead);

// Lấy số tin nhắn chưa đọc (tổng)
router.get('/messages/unread-count', getUnreadCount);

// Lấy số tin nhắn chưa đọc của một conversation
router.get('/conversations/:receiverId/messages/unread-count', getUnreadCountByConversation);

// Lấy số tin nhắn chưa đọc của một booking (backward compatibility)
router.get('/bookings/:bookingId/messages/unread-count', getUnreadCountByBooking);

export default router;

