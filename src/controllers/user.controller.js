// src/controllers/user.controller.js (BACKEND)
import User from '../models/user.model.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { updateUserProfileSchema, changePasswordSchema } from '../validators/user.schema.js';

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

/**
 * Lấy thông tin user hiện tại (đã đăng nhập)
 */
export const getCurrentUser = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId).select('-passwordHash -emailVerification -passwordReset');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error("Error fetching current user:", err);
    next(err);
  }
};

/**
 * Cập nhật thông tin profile của user
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const body = updateUserProfileSchema.parse(req.body);

    // Tìm user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Kiểm tra nếu user đã bị xóa
    if (user.status === 'deleted') {
      return res.status(403).json({ message: 'Account has been deleted' });
    }

    // Cập nhật các trường được phép
    if (body.first_name !== undefined) user.first_name = body.first_name;
    if (body.last_name !== undefined) user.last_name = body.last_name;
    if (body.picture !== undefined) user.picture = body.picture || null;
    if (body.gender !== undefined) user.gender = body.gender;
    if (body.phone !== undefined) {
      // Nếu phone rỗng, set null
      user.phone = body.phone || null;
    }
    if (body.dob !== undefined) {
      // Convert string to Date nếu cần
      user.dob = typeof body.dob === 'string' ? new Date(body.dob) : body.dob;
    }
    if (body.address !== undefined) {
      // Merge address object
      user.address = {
        ...user.address,
        ...body.address
      };
    }

    // Set updatedBy
    user.updatedBy = userId;

    await user.save();

    // Trả về user đã cập nhật (không bao gồm passwordHash)
    const updatedUser = await User.findById(userId).select('-passwordHash -emailVerification -passwordReset');
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: err.errors 
      });
    }
    
    // Kiểm tra duplicate phone
    if (err.code === 11000 && err.keyPattern?.phone) {
      return res.status(400).json({ message: 'Phone number already exists' });
    }
    
    console.error("Error updating user profile:", err);
    next(err);
  }
};

/**
 * Đổi mật khẩu
 */
export const changePassword = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const body = changePasswordSchema.parse(req.body);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Kiểm tra user có mật khẩu local không
    if (!user.auth?.local?.enabled || !user.passwordHash) {
      return res.status(400).json({ message: 'Local password not set. Please set password first.' });
    }

    // Kiểm tra mật khẩu hiện tại
    const isPasswordValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash mật khẩu mới
    const newPasswordHash = await bcrypt.hash(body.newPassword, 10);
    user.passwordHash = newPasswordHash;
    user.updatedBy = userId;

    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: err.errors 
      });
    }
    
    console.error("Error changing password:", err);
    next(err);
  }
};

/**
 * Xóa tài khoản (soft delete)
 */
export const deleteUserAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Kiểm tra nếu đã bị xóa rồi
    if (user.status === 'deleted') {
      return res.status(400).json({ message: 'Account already deleted' });
    }

    // Soft delete: set status = 'deleted'
    user.status = 'deleted';
    user.updatedBy = userId;
    
    // Có thể xóa thông tin nhạy cảm (tùy chọn)
    // user.email = `deleted_${Date.now()}_${user.email}`;
    // user.phone = null;
    
    await user.save();

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error("Error deleting user account:", err);
    next(err);
  }
};