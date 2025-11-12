// src/routers/search.routes.js
import express from 'express';
import { authGuard } from '../middlewares/auth.js';
import {
  getRecommendedListings,
  saveSearchHistory,
  deleteSearchHistory,
  getUserSearchHistory
} from '../controllers/search.controller.js';

const router = express.Router();

// Public: Get AI-recommended listings (không cần auth, nhưng tốt hơn nếu có)
router.get('/recommendations', getRecommendedListings);

// Optional auth: Save search history
router.post('/history', saveSearchHistory);

// Protected: User search history management
router.use(authGuard);

// Get user's search history
router.get('/history', getUserSearchHistory);

// Delete search history
router.delete('/history', deleteSearchHistory);

export default router;

