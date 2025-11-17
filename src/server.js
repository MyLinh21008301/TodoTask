// src/server.js
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import cors from 'cors'; 
import cookieParser from 'cookie-parser'; 

import { connectDB } from './config/db.js';
import authRoutes from './routers/auth.routes.js';
import hostRoutes from './routers/host.routes.js';
import { errorHandler } from './middlewares/error.js';
import listingRoutes from './routers/listing.routes.js';
import bookingRoutes from './routers/booking.routes.js';
import userRoutes from './routers/user.routes.js';
import uploadRoutes from './routers/upload.routes.js';
import notificationRoutes from './routers/notification.routes.js'; // <-- Chỉ 1 dòng
import adminRoutes from './routers/admin.routes.js'; // <-- Đã thêm
import { paymentWebhook } from './controllers/booking.controller.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true 
}));

// === ROUTE WEBHOOK (PHẢI ĐẶT TRƯỚC express.json()) ===
app.post(
  '/api/bookings/webhook',
  express.raw({ type: '*/*' }), // 1. Chỉ dùng Raw body
  (req, _res, next) => {         // 2. Middleware parse thủ công
    try {
      req.rawBody = req.body; // Lưu Buffer thô
      const bodyString = req.body.toString('utf8'); // Chuyển sang string
      req.body = bodyString ? JSON.parse(bodyString) : {}; // Parse thành object
      next();
    } catch (e) {
        console.error("Error parsing webhook body:", e);
        next(e);
    }
  },
  paymentWebhook // 3. Chạy controller
);
// === KẾT THÚC WEBHOOK ===

// Các middleware toàn cục khác (đặt SAU webhook)
app.use(express.json()); 
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/auth/config', (_req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

app.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/host', hostRoutes);    
app.use('/api/listings', listingRoutes);
app.use('/api/bookings', bookingRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes); // <-- Đã thêm

// error handler
app.use(errorHandler);

await connectDB(); 
app.listen(PORT, () => {
    console.log(`Server is running on port 5001`);
    console.log(`>>> Allowing requests from http://localhost:5173`); 
});