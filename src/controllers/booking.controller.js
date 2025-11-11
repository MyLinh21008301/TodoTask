// import crypto from 'crypto';
// import Booking from '../models/booking.model.js';
// import Listing from '../models/listing.model.js';
// import {
//   createBookingSchema, hostDecisionSchema, initiatePaySchema, webhookSchema
// } from '../validators/booking.schema.js';
// import { payos, verifyPayOSSignature } from '../lib/payos.client.js';
// import { buildContractPreviewHash, renderAndStampContractPDF } from '../services/contract.service.js';
// import Notification from '../models/notification.model.js';

// /** ---- Pricing ---- */
// function computePricing(listing, nights) {
//   const base = Math.round(listing.basePrice?.amount || 0);
//   const cleaning = Number(listing.fees?.cleaning || 0);
//   const service  = Number(listing.fees?.service  || 0);
//   const taxPct   = Number(listing.fees?.taxPct   || 0);
//   const subtotal = base * nights + cleaning + service;
//   const tax      = Math.round(subtotal * (taxPct/100));
//   const platformPct = Number(process.env.PLATFORM_FEE_PCT || 5);
//   const platformFee = Math.round(subtotal * (platformPct/100));
//   const total    = subtotal + tax + platformFee;
//   const hostPayout = subtotal + tax - platformFee;
//   return {
//     currency: 'VND',
//     basePricePerNight: base,
//     fees: { cleaning, service },
//     taxPct,
//     subtotal, platformFee, total, hostPayout
//   };
// }

// /** ---- Overlap check ---- */
// async function isOverlapped(listingId, checkin, checkout) {
//   const overlap = await Booking.exists({
//     listingId,
//     status: { $in: ['awaiting_payment', 'payment_processing', 'paid', 'completed'] },
//     checkinDate: { $lt: checkout },
//     checkoutDate: { $gt: checkin }
//   });
//   return !!overlap;
// }

// /** GUEST: tạo yêu cầu đặt */
// export async function createBooking(req, res, next) {
//   try {
//     const body = createBookingSchema.parse(req.body);
//     const listing = await Listing.findOne({ _id: body.listingId, status: 'approved' });
//     if (!listing) return res.status(404).json({ message: 'Listing not found' });

//     const ci = new Date(body.checkinDate);
//     const co = new Date(body.checkoutDate);
//     const nights = Math.ceil((co - ci) / (24*3600*1000));
//     if (isNaN(ci) || isNaN(co) || nights <= 0) {
//       return res.status(400).json({ message: 'Invalid dates' });
//     }
//     if (await isOverlapped(listing._id, ci, co)) {
//       return res.status(409).json({ message: 'Dates already booked' });
//     }

//     const pricing = computePricing(listing, nights);
//     const previewHash = await buildContractPreviewHash({
//       listingId: listing._id,
//       guestId: req.user._id,
//       hostId: listing.hostId,
//       checkinDate: ci,
//       checkoutDate: co,
//       pricing
//     });

//     const doc = await Booking.create({
//       guestId: req.user._id,
//       hostId: listing.hostId,
//       listingId: listing._id,
//       checkinDate: ci,
//       checkoutDate: co,
//       nights,
//       guestCount: body.guestCount,
//       pricing,
//       cancellationPolicy: listing.cancellationPolicy,
//       status: 'requested',
//       contract: { previewHash },
//       requestedAt: new Date()
//     });
//     res.status(201).json(doc);
//   } catch (e) {
//     if (e.code === 11000) {
//         return res.status(409).json({ message: 'These dates have just been booked. Please try again.' });
//     }
//     next(e);
//   }
// }

// /** HOST: chấp nhận → awaiting_payment */
// export async function hostAccept(req, res, next) {
//   try {
//     const { expiresInMinutes } = hostDecisionSchema.parse(req.body ?? {});
//     const b = await Booking.findOne({ _id: req.params.id, hostId: req.user._id, status: 'requested' });
//     if (!b) return res.status(404).json({ message: 'Booking not found' });

//     b.status = 'awaiting_payment';
//     b.hostRespondedAt = new Date();
//     b.expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
//     await b.save();

//     res.json({ message: 'Accepted, awaiting payment', expiresAt: b.expiresAt });
//   } catch (e) { next(e); }
// }

// /** HOST: từ chối */
// export async function hostDecline(req, res, next) {
//   try {
//     const b = await Booking.findOne({ _id: req.params.id, hostId: req.user._id, status: 'requested' });
//     if (!b) return res.status(404).json({ message: 'Booking not found' });
//     b.status = 'host_rejected';
//     b.hostRespondedAt = new Date();
//     await b.save();
//     res.json({ message: 'Declined' });
//   } catch (e) { next(e); }
// }

// /** GUEST: khởi tạo thanh toán (PayOS) */
// export async function initiatePayment(req, res, next) {
//   try {
//     const { provider, method } = initiatePaySchema.parse(req.body ?? {});
//     const b = await Booking.findOne({ _id: req.params.id, guestId: req.user._id });
//     if (!b) return res.status(404).json({ message: 'Booking not found' });

//     if (b.status !== 'awaiting_payment')
//       return res.status(400).json({ message: 'This booking is not available for payment.' });

//     if (b.expiresAt && b.expiresAt < new Date()) {
//       b.status = 'expired'; await b.save();
//       return res.status(400).json({ message: 'Booking expired' });
//     }

//     // === PHẦN SỬA LỖI BẮT ĐẦU TỪ ĐÂY ===

//     // 1. Tạo orderCode là một SỐ NGUYÊN duy nhất bằng Date.now()
//     const orderCode = Date.now();

//     let checkoutUrl = '';
//     let qrData = '';
//     let intentId = '';

//     if (provider === 'payos') {
//       const payload = {
//         orderCode: orderCode, // Gửi đi SỐ NGUYÊN
//         amount: b.pricing.total,
//         // 2. Rút gọn description dưới 25 ký tự
//         description: `TT Booking ${b._id.toString().slice(-8)}`, // Ví dụ: "TT Booking 1a2b3c4d"
//         returnUrl: `${process.env.WEB_BASE_URL}/payment/success?orderCode=${orderCode}`,
//         cancelUrl: `${process.env.WEB_BASE_URL}/payment/cancel?orderCode=${orderCode}`,
//       };
      
//       const link = await payos.paymentRequests.create(payload);
//       checkoutUrl = link?.checkoutUrl ?? '';
//       qrData     = link?.qrCode ?? '';
//       // PayOS có thể trả về `id` hoặc không, dùng orderCode làm fallback
//       intentId   = link?.id ?? String(orderCode);
//     }
    
//     // Lưu lại orderCode dạng chuỗi vào DB để đối soát
//     b.orderCode = String(orderCode);
//     b.payment = {
//       provider, method, intentId, checkoutUrl, qrData, status: 'pending'
//     };
//     await b.save();

//     res.json({
//       orderCode: b.orderCode,
//       amount: b.pricing.total,
//       currency: b.pricing.currency,
//       provider, method, intentId, checkoutUrl, qrData
//     });
//     // === PHẦN SỬA LỖI KẾT THÚC TẠI ĐÂY ===
//   } catch (e) {
//     // Bắt lỗi từ PayOS và trả về thông báo rõ ràng hơn
//     console.error("Error initiating payment with PayOS:", e);
//     // Trả về lỗi 400 (Bad Request) hoặc 502 (Bad Gateway) thay vì 200 OK
//     res.status(400).json({ 
//         message: "Failed to create payment link.",
//         error: e.message // Gửi thông báo lỗi từ PayOS cho client (trong lúc dev)
//     });
//   }
// }

// /** Webhook (PayOS) – dùng raw body để verify signature */
// export async function paymentWebhook(req, res, next) {
//   try {
//     const rawBody = req.rawBody || JSON.stringify(req.body);
//     const signature = req.headers['x-payos-signature'] || req.headers['x-hub-signature'];
//     if (!verifyPayOSSignature({ rawBody, signatureHeader: signature })) {
//       return res.status(400).json({ ok:false, message: 'invalid signature' });
//     }

//     const body = webhookSchema.parse(req.body);
//     const cond = body.orderCode ? { orderCode: body.orderCode } : { 'payment.intentId': body.intentId };

//     const b = await Booking.findOne(cond);
//     if (!b) return res.status(404).json({ ok:false });

//     if (b.status === 'paid' && body.status === 'succeeded') {
//         console.log(`Webhook for order ${b.orderCode} already processed.`);
//         return res.json({ ok: true, message: 'Already processed' });
//     }

//     if (body.status === 'succeeded') {
//       b.payment.status = 'succeeded';
//       b.payment.paidAt = new Date();
//       b.payment.txns = b.payment.txns || [];
//       b.payment.txns.push({
//         providerTxnId: body.providerTxnId || '',
//         amount: b.pricing.total,
//         status: 'succeeded',
//         at: new Date(),
//         raw: req.body
//       });
//       b.status = 'paid';

//       const pdfRef = await renderAndStampContractPDF({ booking: b });
//       b.contract = {
//         ...(b.contract || {}),
//         executedAt: new Date(),
//         pdf: pdfRef
//       };

//       await b.save();
//       return res.json({ ok:true });
//     }

//     if (body.status === 'failed') {
//       b.payment.status = 'failed';
//       await b.save();
//       return res.json({ ok:true });
//     }

//     if (body.status === 'refunded') {
//       b.payment.status = 'refunded';
//       b.status = 'refunded';
//       await b.save();
//       return res.json({ ok:true });
//     }

//     res.json({ ok:true });
//   } catch (e) { next(e); }
// }

// /** Guest xem đơn của mình */
// export async function listMineGuest(req, res, next) {
//   try {
//     const { status, limit=20, skip=0 } = req.query;
//     const cond = { guestId: req.user._id };
//     if (status) cond.status = status;
//     const [items, total] = await Promise.all([
//       Booking.find(cond).limit(Number(limit)).skip(Number(skip)).sort({ createdAt:-1 }),
//       Booking.countDocuments(cond)
//     ]);
//     res.json({ items, total, limit:Number(limit), skip:Number(skip) });
//   } catch (e) { next(e); }
// }

// /** Host xem yêu cầu của mình */
// export async function listMineHost(req, res, next) {
//   try {
//     const { status, limit=20, skip=0 } = req.query;
//     const cond = { hostId: req.user._id };
//     if (status) cond.status = status;
//     const [items, total] = await Promise.all([
//       Booking.find(cond).limit(Number(limit)).skip(Number(skip)).sort({ createdAt:-1 }),
//       Booking.countDocuments(cond)
//     ]);
//     res.json({ items, total, limit:Number(limit), skip:Number(skip) });
//   } catch (e) { next(e); }
// }

// src/controllers/booking.controller.js
import crypto from 'crypto';
import Booking from '../models/booking.model.js';
import Listing from '../models/listing.model.js';
import {
  createBookingSchema, hostDecisionSchema, initiatePaySchema, webhookSchema
} from '../validators/booking.schema.js';
import { payos, verifyPayOSSignature } from '../lib/payos.client.js';
import { buildContractPreviewHash, renderAndStampContractPDF } from '../services/contract.service.js';
// --- THÊM DÒNG NÀY ---
import Notification from '../models/notification.model.js';

/** ---- Pricing ---- */
function computePricing(listing, nights) {
  const base = Math.round(listing.basePrice?.amount || 0);
  const cleaning = Number(listing.fees?.cleaning || 0);
  const service  = Number(listing.fees?.service  || 0);
  const taxPct   = Number(listing.fees?.taxPct   || 0);
  const subtotal = base * nights + cleaning + service;
  const tax      = Math.round(subtotal * (taxPct/100));
  const platformPct = Number(process.env.PLATFORM_FEE_PCT || 5);
  const platformFee = Math.round(subtotal * (platformPct/100));
  const total    = subtotal + tax + platformFee;
  const hostPayout = subtotal + tax - platformFee;
  return {
    currency: 'VND',
    basePricePerNight: base,
    fees: { cleaning, service },
    taxPct,
    subtotal, platformFee, total, hostPayout
  };
}

/** ---- Overlap check ---- */
async function isOverlapped(listingId, checkin, checkout) {
  const overlap = await Booking.exists({
    listingId,
    status: { $in: ['awaiting_payment', 'payment_processing', 'paid', 'completed'] },
    checkinDate: { $lt: checkout },
    checkoutDate: { $gt: checkin }
  });
  return !!overlap;
}

/** GUEST: tạo yêu cầu đặt */
export async function createBooking(req, res, next) {
  try {
    const body = createBookingSchema.parse(req.body);
    const listing = await Listing.findOne({ _id: body.listingId, status: 'approved' });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });

    const ci = new Date(body.checkinDate);
    const co = new Date(body.checkoutDate);
    const nights = Math.ceil((co - ci) / (24*3600*1000));
    if (isNaN(ci) || isNaN(co) || nights <= 0) {
      return res.status(400).json({ message: 'Invalid dates' });
    }
    if (await isOverlapped(listing._id, ci, co)) {
      return res.status(409).json({ message: 'Dates already booked' });
    }

    const pricing = computePricing(listing, nights);
    const previewHash = await buildContractPreviewHash({
      listingId: listing._id,
      guestId: req.user._id,
      hostId: listing.hostId,
      checkinDate: ci,
      checkoutDate: co,
      pricing
    });

    const doc = await Booking.create({
      guestId: req.user._id,
      hostId: listing.hostId,
      listingId: listing._id,
      checkinDate: ci,
      checkoutDate: co,
      nights,
      guestCount: body.guestCount,
      pricing,
      cancellationPolicy: listing.cancellationPolicy,
      status: 'requested',
      contract: { previewHash },
      requestedAt: new Date()
    });
    res.status(201).json(doc);
  } catch (e) {
    if (e.code === 11000) {
        return res.status(409).json({ message: 'These dates have just been booked. Please try again.' });
    }
    next(e);
  }
}

/** HOST: chấp nhận → awaiting_payment */
export async function hostAccept(req, res, next) {
  try {
    const { expiresInMinutes } = hostDecisionSchema.parse(req.body ?? {});
    const b = await Booking.findOne({ _id: req.params.id, hostId: req.user._id, status: 'requested' });
    if (!b) return res.status(404).json({ message: 'Booking not found' });

    b.status = 'awaiting_payment';
    b.hostRespondedAt = new Date();
    b.expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    
    // --- BẮT ĐẦU THAY ĐỔI ---
    // 1. Lưu booking TRƯỚC
    await b.save();

    // 2. Tạo thông báo cho Guest (không cần await)
    Notification.create({
      userId: b.guestId,
      message: `Yêu cầu đặt phòng của bạn đã được chấp nhận. Vui lòng thanh toán trước khi hết hạn.`,
      link: `/my-bookings/${b._id}` // Link đến trang chi tiết booking
    });
    // --- KẾT THÚC THAY ĐỔI ---

    res.json({ message: 'Accepted, awaiting payment', expiresAt: b.expiresAt });
  } catch (e) { next(e); }
}

/** HOST: từ chối */
export async function hostDecline(req, res, next) {
  try {
    const b = await Booking.findOne({ _id: req.params.id, hostId: req.user._id, status: 'requested' });
    if (!b) return res.status(404).json({ message: 'Booking not found' });
    
    b.status = 'host_rejected';
    b.hostRespondedAt = new Date();
    
    // --- BẮT ĐẦU THAY ĐỔI ---
    // 1. Lưu booking TRƯỚC
    await b.save();

    // 2. Tạo thông báo cho Guest (không cần await)
    Notification.create({
      userId: b.guestId,
      message: `Rất tiếc, yêu cầu đặt phòng của bạn đã bị từ chối.`,
      link: `/my-bookings/${b._id}`
    });
    // --- KẾT THÚC THAY ĐỔI ---

    res.json({ message: 'Declined' });
  } catch (e) { next(e); }
}

/** GUEST: khởi tạo thanh toán (PayOS) */
export async function initiatePayment(req, res, next) {
  try {
    const { provider, method } = initiatePaySchema.parse(req.body ?? {});
    const b = await Booking.findOne({ _id: req.params.id, guestId: req.user._id });
    if (!b) return res.status(404).json({ message: 'Booking not found' });

    if (b.status !== 'awaiting_payment')
      return res.status(400).json({ message: 'This booking is not available for payment.' });

    if (b.expiresAt && b.expiresAt < new Date()) {
      b.status = 'expired'; await b.save();
      return res.status(400).json({ message: 'Booking expired' });
    }

    // 1. Tạo orderCode là một SỐ NGUYÊN duy nhất bằng Date.now()
    const orderCode = Date.now();

    let checkoutUrl = '';
    let qrData = '';
    let intentId = '';

    if (provider === 'payos') {
      const payload = {
        orderCode: orderCode, // Gửi đi SỐ NGUYÊN
        amount: b.pricing.total,
        // 2. Rút gọn description dưới 25 ký tự
        description: `TT Booking ${b._id.toString().slice(-8)}`, // Ví dụ: "TT Booking 1a2b3c4d"
        returnUrl: `${process.env.WEB_BASE_URL}/payment/success?orderCode=${orderCode}`,
        cancelUrl: `${process.env.WEB_BASE_URL}/payment/cancel?orderCode=${orderCode}`,
      };
      
      const link = await payos.paymentRequests.create(payload);
      checkoutUrl = link?.checkoutUrl ?? '';
      qrData     = link?.qrCode ?? '';
      // PayOS có thể trả về `id` hoặc không, dùng orderCode làm fallback
      intentId   = link?.id ?? String(orderCode);
    }
    
    // Lưu lại orderCode dạng chuỗi vào DB để đối soát
    b.orderCode = String(orderCode);
    b.payment = {
      provider, method, intentId, checkoutUrl, qrData, status: 'pending'
    };
    await b.save();

    res.json({
      orderCode: b.orderCode,
      amount: b.pricing.total,
      currency: b.pricing.currency,
      provider, method, intentId, checkoutUrl, qrData
    });
  } catch (e) {
    console.error("Error initiating payment with PayOS:", e);
    res.status(400).json({ 
        message: "Failed to create payment link.",
        error: e.message
    });
  }
}

/** Webhook (PayOS) – dùng raw body để verify signature */
export async function paymentWebhook(req, res, next) {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-payos-signature'] || req.headers['x-hub-signature'];
    if (!verifyPayOSSignature({ rawBody, signatureHeader: signature })) {
      return res.status(400).json({ ok:false, message: 'invalid signature' });
    }

    const body = webhookSchema.parse(req.body);
    const cond = body.orderCode ? { orderCode: body.orderCode } : { 'payment.intentId': body.intentId };

    const b = await Booking.findOne(cond);
    if (!b) return res.status(404).json({ ok:false });

    if (b.status === 'paid' && body.status === 'succeeded') {
        console.log(`Webhook for order ${b.orderCode} already processed.`);
        return res.json({ ok: true, message: 'Already processed' });
    }

    if (body.status === 'succeeded') {
      b.payment.status = 'succeeded';
      b.payment.paidAt = new Date();
      b.payment.txns = b.payment.txns || [];
      b.payment.txns.push({
        providerTxnId: body.providerTxnId || '',
        amount: b.pricing.total,
        status: 'succeeded',
        at: new Date(),
        raw: req.body
      });
      b.status = 'paid';

      const pdfRef = await renderAndStampContractPDF({ booking: b });
      b.contract = {
        ...(b.contract || {}),
        executedAt: new Date(),
        pdf: pdfRef
      };

      await b.save();
      return res.json({ ok:true });
    }

    if (body.status === 'failed') {
      b.payment.status = 'failed';
      await b.save();
      return res.json({ ok:true });
    }

    if (body.status === 'refunded') {
      b.payment.status = 'refunded';
      b.status = 'refunded';
      await b.save();
      return res.json({ ok:true });
    }

    res.json({ ok:true });
  } catch (e) { next(e); }
}

/** Guest xem đơn của mình */
export async function listMineGuest(req, res, next) {
  try {
    const { status, limit=20, skip=0 } = req.query;
    const cond = { guestId: req.user._id };
    if (status) cond.status = status;
    const [items, total] = await Promise.all([
      Booking.find(cond).limit(Number(limit)).skip(Number(skip)).sort({ createdAt:-1 }),
      Booking.countDocuments(cond)
    ]);
    res.json({ items, total, limit:Number(limit), skip:Number(skip) });
  } catch (e) { next(e); }
}

/** Host xem yêu cầu của mình */
export async function listMineHost(req, res, next) {
  try {
    const { status, limit=20, skip=0 } = req.query;
    const cond = { hostId: req.user._id };
    if (status) cond.status = status;
    const [items, total] = await Promise.all([
      Booking.find(cond).limit(Number(limit)).skip(Number(skip)).sort({ createdAt:-1 }),
      Booking.countDocuments(cond)
    ]);
    res.json({ items, total, limit:Number(limit), skip:Number(skip) });
  } catch (e) { next(e); }
}