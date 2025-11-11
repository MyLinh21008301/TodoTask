// src/server.js (Đã sửa lỗi CORS)

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
import notificationRoutes from './routers/notification.routes.js';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({
  origin: 'http://localhost:5173', 
  credentials: true 
}));

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

// error handler
app.use(errorHandler);

await connectDB(); 
app.listen(PORT, () => {
    console.log(`Server is running on port 5001`);
    console.log(`>>> Allowing requests from http://localhost:5173`); 
});