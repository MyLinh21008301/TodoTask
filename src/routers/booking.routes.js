// src/routes/booking.routes.js
import express from 'express';
import {
  createBooking, hostAccept, hostDecline, 
  listMineGuest, listMineHost,
  getBookingById, getBookingByOrderCode,
  signBooking, getHostDashboardCounts, 
  getHostRevenueStats, getUnavailableDates,
  cancelBooking, adminConfirmRefund 
} from '../controllers/booking.controller.js';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import Booking from '../models/booking.model.js';
const r = express.Router();

/** Auto-expire các booking quá hạn chờ thanh toán*/
async function expireStaleAwaiting(req, _res, next) {
  try {
    await Booking.updateMany(
      { status: 'awaiting_payment', expiresAt: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );
    next();
  } catch (e) { next(e); }
}
r.get('/unavailable/:listingId', getUnavailableDates);
// Guest Routes
r.post('/', authGuard, requireRole('guest'), express.json(), createBooking);
r.get('/mine', authGuard, requireRole('guest'), expireStaleAwaiting, listMineGuest);
// r.post('/:id/pay/initiate', authGuard, requireRole('guest'), express.json(), initiatePayment);
r.post('/:id/cancel', authGuard, requireRole('guest'), express.json(), cancelBooking);
r.post('/:id/sign', authGuard, requireRole('guest'), express.json(), signBooking);


// Host Routes
r.get('/host/mine', authGuard, requireRole('host'), expireStaleAwaiting, listMineHost);
r.post('/:id/host-accept', authGuard, requireRole('host'), express.json(), hostAccept);
r.post('/:id/host-decline', authGuard, requireRole('host'), express.json(), hostDecline);
r.get('/host/counts', authGuard, requireRole('host'), getHostDashboardCounts);
r.get('/host/revenue', authGuard, requireRole('host'), getHostRevenueStats);

r.get('/by-order/:orderCode', getBookingByOrderCode);

// Lấy bằng ID (cho trang thanh toán & hợp đồng - VẪN CẦN BẢO MẬT)
r.get('/:id', authGuard, getBookingById);

r.post('/:id/refund-confirm', authGuard, requireRole('admin'), express.json(), adminConfirmRefund);

export default r;