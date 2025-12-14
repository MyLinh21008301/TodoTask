// src/routers/listing.routes.js
import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import {
  getApprovedListing, searchApproved,
  listMine, createListing, updateListing, submitForReview,
  archiveListing, unarchiveListing, reorderPhotos, removePhoto,
  adminModerateListing, adminList, adminGetOne,adminUpdateStatus
} from '../controllers/listing.controller.js';

// <<< IMPORT CONTROLLER REVIEW >>>
import { createReview } from '../controllers/review.controller.js';

const router = express.Router();

// Guest (public)
router.get('/search', searchApproved);

// Host Routes
router.get('/mine', authGuard, requireRole('host'), listMine);
router.post('/create', authGuard, requireRole('host'), express.json(), createListing);
router.put('/:id', authGuard, requireRole('host'), express.json(), updateListing);
router.post('/:id/submit', authGuard, requireRole('host'), submitForReview);
router.post('/:id/archive', authGuard, requireRole('host'), archiveListing);
router.post('/:id/unarchive', authGuard, requireRole('host'), unarchiveListing);
router.post('/:id/photos/reorder', authGuard, requireRole('host'), express.json(), reorderPhotos);
router.delete('/:id/photos', authGuard, requireRole('host'), express.json(), removePhoto);

// Admin Routes
router.get('/admin/list', authGuard, requireRole('admin'), adminList);
router.get('/admin/:id',  authGuard, requireRole('admin'), adminGetOne);
router.post('/:id/moderate', authGuard, requireRole('admin'), express.json(), adminModerateListing);
router.patch('/admin/:id/status', authGuard, requireRole('admin'), express.json(), adminUpdateStatus);

// <<< THÊM ROUTE REVIEW (GUEST) >>>
router.post('/review', authGuard, requireRole('guest'), express.json(), createReview);

// get by id
router.get('/:id', getApprovedListing);

export default router;