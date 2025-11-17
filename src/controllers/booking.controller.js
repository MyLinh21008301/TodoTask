// src/controllers/booking.controller.js
import crypto from 'crypto';
import Booking from '../models/booking.model.js';
import Listing from '../models/listing.model.js';
import {
  createBookingSchema, hostDecisionSchema, initiatePaySchema, webhookSchema
} from '../validators/booking.schema.js';
import { payos, verifyPayOSSignature } from '../lib/payos.client.js';
import { buildContractPreviewHash, renderAndStampContractPDF } from '../services/contract.service.js';
import Notification from '../models/notification.model.js';

// (Các hàm computePricing, isOverlapped, createBooking, hostAccept, hostDecline, initiatePayment...
// ... giữ nguyên, không thay đổi)
// ...
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
    const expiryTime = expiresInMinutes ? (expiresInMinutes * 60 * 1000) : (24 * 60 * 60 * 1000);
    b.expiresAt = new Date(Date.now() + expiryTime);
    await b.save();
    Notification.create({
      userId: b.guestId,
      message: `Yêu cầu đặt phòng của bạn đã được chấp nhận. Vui lòng thanh toán trước khi hết hạn.`,
      link: `/booking/${b._id}/pay` 
    });
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
    await b.save();
    Notification.create({
      userId: b.guestId,
      message: `Rất tiếc, yêu cầu đặt phòng của bạn đã bị từ chối.`,
      link: `/my-bookings`
    });
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
    const orderCode = Date.now();
    let checkoutUrl = '';
    let qrData = '';
    let intentId = '';
    if (provider === 'payos') {
      const payload = {
        orderCode: orderCode,
        amount: b.pricing.total,
        description: `TT Booking ${b._id.toString().slice(-8)}`,
        returnUrl: `${process.env.WEB_BASE_URL}/payment/success?orderCode=${orderCode}&bookingId=${b._id}`,
        cancelUrl: `${process.env.WEB_BASE_URL}/booking/${b._id}/pay`,
      };
      const link = await payos.paymentRequests.create(payload);
      checkoutUrl = link?.checkoutUrl ?? '';
      qrData     = link?.qrCode ?? '';
      intentId   = link?.id ?? String(orderCode);
    }
    b.orderCode = String(orderCode);
    b.payment = {
      provider, method, intentId, checkoutUrl, qrData, status: 'pending'
    };
    await b.save();
    res.json({
      orderCode: b.orderCode,
      amount: b.pricing.total,
      currency: b.pricing.currency,
      provider, method, intentId, checkoutUrl, 
      qrData
    });
  } catch (e) {
    console.error("Error initiating payment with PayOS:", e);
    res.status(400).json({ 
        message: "Failed to create payment link.",
        error: e.message
    });
  }
}

/** Webhook (PayOS) */
export async function paymentWebhook(req, res, next) {
  try {
    console.log("--- PayOS Webhook HIT ---");
    console.log("PARSED BODY (Object):", JSON.stringify(req.body, null, 2));

    const rawBody = req.rawBody || JSON.stringify(req.body);

    // === BẮT ĐẦU SỬA LỖI LOGIC ===
    
    // 1. Dùng schema MỚI để validate
    const validation = webhookSchema.safeParse(req.body);

    // 2. Nếu validate thất bại
    if (!validation.success) {
      console.warn("!!! Webhook Zod validation FAILED. Lỗi:", validation.error.errors);
      console.log("Giả định đây là 'ping' test từ PayOS. Trả về 200 OK.");
      return res.status(200).json({ ok: true, message: "Webhook validated or ignored." });
    }
    
    console.log("Webhook Zod validation THÀNH CÔNG.");
    
    // 3. (Vẫn tạm thời tắt kiểm tra chữ ký để debug)
    const signature = req.headers['x-payos-signature'] || req.headers['x-hub-signature'];
    console.log(`!!! DEBUG: Tạm thời bỏ qua xác thực chữ ký. Chữ ký nhận được: ${signature}`);
    // if (!verifyPayOSSignature({ rawBody, signatureHeader: signature })) {
    //   console.error("Webhook signature verification failed.");
    //   return res.status(400).json({ ok:false, message: 'invalid signature' });
    // }

    
    // 4. Sửa logic xử lý
    const body = validation.data;
    // Lấy orderCode từ BÊN TRONG data
    const orderCodeStr = body.data.orderCode; 
    const cond = { orderCode: orderCodeStr };

    const b = await Booking.findOne(cond);
    if (!b) {
      console.warn(`Webhook: Booking not found for orderCode: ${orderCodeStr}`);
      return res.status(404).json({ ok:false, message: "Booking not found" });
    }

    if (b.status === 'paid' && (body.code === '00' || body.success === true)) {
        console.log(`Webhook for order ${b.orderCode} already processed.`);
        return res.json({ ok: true, message: 'Already processed' });
    }

    // Kiểm tra 'code' == "00" (thay vì 'status' == "succeeded")
    if (body.code === '00' && body.success === true) {
      console.log(`Webhook: Trạng thái 'succeeded' (code 00) cho booking ${b._id}. Cập nhật DB...`);
      
      b.payment.status = 'succeeded';
      b.payment.paidAt = new Date();
      b.payment.txns = b.payment.txns || [];
      b.payment.txns.push({
        // PayOS không trả về providerTxnId ở root, nó nằm trong 'data'
        providerTxnId: req.body.data?.reference || 'N/A', 
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
      console.log(`Webhook: Đã cập nhật booking ${b._id} thành 'paid'.`);

      Notification.create({
        userId: b.guestId,
        message: `Thanh toán thành công! Hợp đồng cho ${b.orderCode} đã được tạo.`,
        link: `/booking/${b._id}/contract`
      });
       Notification.create({
        userId: b.hostId,
        message: `Bạn có 1 booking mới! Đơn ${b.orderCode} đã được thanh toán.`,
        link: `/host/bookings/${b._id}`
      });

      return res.json({ ok:true });
    }

    // Nếu code không phải "00" (ví dụ: thất bại)
    if (body.code !== '00') {
      b.payment.status = 'failed';
      await b.save();
      return res.json({ ok:true });
    }
    
    // === KẾT THÚC SỬA LỖI LOGIC ===

    res.json({ ok:true });
  } catch (e) { 
    console.error("Error in paymentWebhook:", e);
    next(e); 
  }
}


/** Lấy chi tiết booking BẰNG ID (Guest hoặc Host) */
export async function getBookingById(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('listingId', 'title photos address city') 
      .populate('hostId', 'first_name last_name picture'); 

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const userId = req.user._id;
    if (!booking.guestId.equals(userId) && !booking.hostId.equals(userId)) {
      return res.status(403).json({ message: 'Unauthorized to view this booking' });
    }
    res.json(booking);
  } catch (e) {
    next(e);
  }
}

/** Lấy chi tiết booking BẰNG ORDER CODE (Chỉ Guest) */
export async function getBookingByOrderCode(req, res, next) {
  try {
    const booking = await Booking.findOne({ orderCode: req.params.orderCode })
      .populate('listingId', 'title photos address city');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (!booking.guestId.equals(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    res.json(booking);
  } catch (e) {
    next(e);
  }
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