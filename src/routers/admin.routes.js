// src/routes/admin.routes.js
import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import {
  getAdminDashboardCounts,
  listHostApplications,
  approveHostApplication,
  listListingsForModeration,
  adminListBookings,
  getAdminRevenueStats,
  adminListUsers,      
  adminListAllListings,
  adminToggleUserStatus,
  getLatestPayoutBatch,    
  listHostSettlements,   
  confirmSettlementPayment
} from '../controllers/admin.controller.js';
import { adminModerateListing } from '../controllers/listing.controller.js'; 

const router = express.Router();

router.use(authGuard, requireRole('admin'));

router.get('/dashboard-counts', getAdminDashboardCounts);
router.get('/revenue-stats', getAdminRevenueStats);
router.get('/host-applications', listHostApplications);
router.post('/approve-host', express.json(), approveHostApplication);
router.get('/listings-moderation', express.json(), listListingsForModeration);
router.post('/listings/:id/moderate', adminModerateListing);
router.get('/bookings', adminListBookings);
// User Management
router.get('/users', adminListUsers);
router.patch('/users/:id/status', express.json(), adminToggleUserStatus);

// Listing Management (Tổng hợp)
router.get('/listings', adminListAllListings);


router.get('/payouts/batch/latest', getLatestPayoutBatch);
router.get('/payouts/settlements', listHostSettlements);
router.post('/payouts/settlements/:id/pay', confirmSettlementPayment);
export default router;