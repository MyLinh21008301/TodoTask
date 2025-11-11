// src/controllers/notification.controller.js
import Notification from '../models/notification.model.js';

// Lấy tất cả thông báo của user (đã đăng nhập)
export const getMyNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 }) // Mới nhất lên đầu
      .limit(50); // Giới hạn 50 thông báo gần nhất
    
    res.json(notifications);
  } catch (e) { next(e); }
};

// Đếm số thông báo CHƯA ĐỌC
export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({ 
      userId: req.user._id, 
      read: false 
    });
    res.json({ count });
  } catch (e) { next(e); }
};

// Đánh dấu TẤT CẢ thông báo là đã đọc
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );
    res.json({ message: 'All marked as read' });
  } catch (e) { next(e); }
};