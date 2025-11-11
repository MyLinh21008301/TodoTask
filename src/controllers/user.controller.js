// src/controllers/user.controller.js (BACKEND)
import User from '../models/user.model.js';
import mongoose from 'mongoose';

// Hàm lấy thông tin công khai của user bằng ID
export const getUserPublicProfileById = async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Kiểm tra ID hợp lệ
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid User ID format' });
    }

    // Tìm user và chỉ chọn các trường công khai cần thiết
    const user = await User.findById(userId).select('first_name last_name picture createdAt host.status'); // Chỉ lấy tên, ảnh, ngày tạo, trạng thái host

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Trả về dữ liệu công khai (Mongoose tự động dùng toJSON đã loại bỏ passwordHash)
    res.json(user);

  } catch (err) {
    console.error("Error fetching user profile:", err);
    next(err); // Chuyển lỗi cho error handler chung
  }
};

// Có thể thêm các controller khác liên quan đến user ở đây (vd: get current user profile...)