import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import {
  getApprovedListing, searchApproved,
  listMine, createListing, updateListing, submitForReview,
  archiveListing, unarchiveListing, reorderPhotos, removePhoto,
  adminModerateListing, adminList, adminGetOne
} from '../controllers/listing.controller.js';

const router = express.Router();

// Guest (public)
router.get('/search', searchApproved);


router.get('/mine', authGuard, requireRole('host'), listMine);
router.post('/create', authGuard, requireRole('host'), express.json(), createListing);
router.put('/:id', authGuard, requireRole('host'), express.json(), updateListing);
router.post('/:id/submit', authGuard, requireRole('host'), submitForReview);
router.post('/:id/archive', authGuard, requireRole('host'), archiveListing);
router.post('/:id/unarchive', authGuard, requireRole('host'), unarchiveListing);
router.post('/:id/photos/reorder', authGuard, requireRole('host'), express.json(), reorderPhotos);
router.delete('/:id/photos', authGuard, requireRole('host'), express.json(), removePhoto);

// Admin (duyệt listing)
router.get('/admin/list', authGuard, requireRole('admin'), adminList);
router.get('/admin/:id',  authGuard, requireRole('admin'), adminGetOne);
router.post('/:id/moderate', authGuard, requireRole('admin'), express.json(), adminModerateListing);

// get by id
router.get('/:id', getApprovedListing);


export default router;
