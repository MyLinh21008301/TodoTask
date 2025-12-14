// src/routers/promotion.routes.js
import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import { createPromotion, getMyPromotions, checkPromotionCode, deletePromotion, getPromotionById, getPromotionsForListing } from '../controllers/promotion.controller.js';
const router = express.Router();

router.post('/create', authGuard, requireRole('host'), express.json(), createPromotion);
router.get('/mine', authGuard, requireRole('host'), getMyPromotions);
router.get('/:id', authGuard, requireRole('host'), getPromotionById);
router.delete('/:id', authGuard, requireRole('host'), deletePromotion); 
router.post('/check', express.json(), checkPromotionCode);
router.get('/listing/:listingId', getPromotionsForListing);

export default router;