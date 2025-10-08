import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { requireRole } from '../middlewares/roles.js';
import {
  createBooking, hostAccept, hostDecline,
  initiatePayment, paymentWebhook,
  listMineGuest, listMineHost
} from '../controllers/booking.controller.js';

const r = express.Router();

// Guest
r.post('/', authGuard, requireRole('guest'), express.json(), createBooking);
r.get('/mine', authGuard, requireRole('guest'), listMineGuest);
r.post('/:id/pay/initiate', authGuard, requireRole('guest'), express.json(), initiatePayment);

// Host
r.get('/host/mine', authGuard, requireRole('host'), listMineHost);
r.post('/:id/host-accept', authGuard, requireRole('host'), express.json(), hostAccept);
r.post('/:id/host-decline', authGuard, requireRole('host'), express.json(), hostDecline);

// Webhook (public – NHỚ verify HMAC trong controller khi nối cổng thật)
r.post('/webhook', express.json(), paymentWebhook);

export default r;
