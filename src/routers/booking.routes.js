// src/routes/booking.routes.js
import express from 'express';
import {
  createBooking, hostAccept, hostDecline,
  initiatePayment, // paymentWebhook đã bị xóa khỏi đây
  listMineGuest, listMineHost,
  getBookingById, getBookingByOrderCode
} from '../controllers/booking.controller.js';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import Booking from '../models/booking.model.js';

const r = express.Router();

/** Auto-expire các booking quá hạn chờ thanh toán (middleware nhẹ) */
async function expireStaleAwaiting(req, _res, next) {
  try {
    await Booking.updateMany(
      { status: 'awaiting_payment', expiresAt: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );
    next();
  } catch (e) { next(e); }
}

// Guest Routes
r.post('/', authGuard, requireRole('guest'), express.json(), createBooking);
r.get('/mine', authGuard, requireRole('guest'), expireStaleAwaiting, listMineGuest);
r.post('/:id/pay/initiate', authGuard, requireRole('guest'), express.json(), initiatePayment);

// Host Routes
r.get('/host/mine', authGuard, requireRole('host'), expireStaleAwaiting, listMineHost);
r.post('/:id/host-accept', authGuard, requireRole('host'), express.json(), hostAccept);
r.post('/:id/host-decline', authGuard, requireRole('host'), express.json(), hostDecline);
r.get('/by-order/:orderCode', authGuard, getBookingByOrderCode);

// Lấy bằng ID (cho trang thanh toán & hợp đồng)
r.get('/:id', authGuard, getBookingById);


// === ROUTE WEBHOOK ĐÃ BỊ XÓA KHỎI ĐÂY ===


export default r;