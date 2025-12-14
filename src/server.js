// src/server.js
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
import notificationRoutes from './routers/notification.routes.js';
import adminRoutes from './routers/admin.routes.js';
import chatRoutes from './routers/chat.routes.js';
import searchRoutes from './routers/search.routes.js';
import { paymentWebhook } from './controllers/booking.controller.js';
import { setupChatSocket } from './services/chat.socket.js';
import promotionRoutes from './routers/promotion.routes.js';

const app = express();
const httpServer = createServer(app); 

const PORT = process.env.PORT || 5001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
  process.env.FRONTEND_URL 
].filter(Boolean); 

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.post(
  '/api/bookings/webhook',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    try {
      req.rawBody = req.body;
      req.body = JSON.parse(req.body.toString('utf8'));
      next();
    } catch (e) {
      next(e);
    }
  },
  paymentWebhook 
);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins, 
    credentials: true,
    methods: ['GET', 'POST']
  }
});

setupChatSocket(io);

app.use(express.json()); 
app.use(cookieParser());

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/auth/config', (_req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

app.get('/health', (_req, res) => res.json({ ok: true, status: 'Server is running', time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/host', hostRoutes);    
app.use('/api/listings', listingRoutes);
app.use('/api/bookings', bookingRoutes); 
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/chat', chatRoutes);   
app.use('/api/search', searchRoutes);
app.use('/api/promotions', promotionRoutes);

app.use(errorHandler);

await connectDB(); 

httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Allowed Origins:`, allowedOrigins);
    console.log(`WebSocket server ready`);
});