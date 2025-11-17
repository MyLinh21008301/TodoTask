// src/routers/user.routes.js
import express from 'express';
import { authGuard } from '../middlewares/auth.js';
import { 
  getUserPublicProfileById,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  deleteUserAccount
} from '../controllers/user.controller.js';

const router = express.Router();

// Protected routes: Quản lý thông tin cá nhân (cần authentication)
// Phải đặt trước route /:id để tránh conflict với "me"

// Get information of current user
router.get('/me', authGuard, getCurrentUser);

// Update information of current user
router.patch('/me', authGuard, express.json(), updateUserProfile);

// Change password
router.patch('/me/password', authGuard, express.json(), changePassword);

// Delete account (soft delete)
router.delete('/me', authGuard, deleteUserAccount);

// Public route: Get public information of user by ID (must be after /me)
router.get('/:id', getUserPublicProfileById);

export default router;