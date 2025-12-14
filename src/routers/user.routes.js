// src/routers/user.routes.js
import express from 'express';
import { authGuard } from '../middlewares/auth.js';
import { 
  toggleWishlist, 
  getWishlist 
} from '../controllers/user.controller.js';
import { 
  getUserPublicProfileById,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  deleteUserAccount
} from '../controllers/user.controller.js';

const router = express.Router();

// Protected routes: Quản lý thông tin cá nhân (cần authentication)

router.get('/me', authGuard, getCurrentUser);

// [SỬA Ở ĐÂY]: Đổi từ patch -> put để khớp với Frontend
router.put('/me', authGuard, express.json(), updateUserProfile);

// Change password (Thường đổi pass cũng có thể dùng PUT hoặc PATCH, nhưng nên thống nhất)
router.put('/me/password', authGuard, express.json(), changePassword); 

// Delete account (soft delete)
router.delete('/me', authGuard, deleteUserAccount);

router.post('/wishlist/toggle', authGuard, toggleWishlist);
router.get('/wishlist', authGuard, getWishlist);

// Public route: Get public information of user by ID (must be after /me)
router.get('/:id', getUserPublicProfileById);




export default router;