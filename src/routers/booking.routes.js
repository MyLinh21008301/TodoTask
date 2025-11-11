import express from 'express';
import {
  createBooking, hostAccept, hostDecline,
  initiatePayment, paymentWebhook,
  listMineGuest, listMineHost
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

// Webhook (public) – Dùng raw body để verify chữ ký của cổng thanh toán
r.post(
  '/webhook',
  // Middleware này phải đứng TRƯỚC express.json()
  // Nó sẽ đọc luồng request và lưu body gốc vào req.rawBody
  express.raw({ type: '*/*' }),
  // Middleware tiếp theo sẽ parse body thô đó thành JSON để controller sử dụng
  (req, _res, next) => {
    try {
      req.rawBody = req.body; // lưu lại buffer gốc
      const bodyString = req.body.toString('utf8');
      req.body = bodyString ? JSON.parse(bodyString) : {}; // parse lại thành object
      next();
    } catch (e) {
        console.error("Error parsing webhook body:", e);
        next(e);
    }
  },
  paymentWebhook
);

export default r;