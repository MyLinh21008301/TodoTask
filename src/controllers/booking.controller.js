// src/controllers/booking.controller.js
import crypto from 'crypto';
import Booking from '../models/booking.model.js';
import Listing from '../models/listing.model.js';
import {
  createBookingSchema, hostDecisionSchema, webhookSchema, cancelBookingSchema
} from '../validators/booking.schema.js';
import { payos, verifyPayOSSignature } from '../lib/payos.client.js';
import { buildContractPreviewHash, renderAndStampContractPDF } from '../services/contract.service.js';
import Notification from '../models/notification.model.js';
import Promotion from '../models/promotion.model.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3 } from '../config/s3.js';
import User from '../models/user.model.js';

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

async function isOverlapped(listingId, checkin, checkout) {
  const overlap = await Booking.exists({
    listingId,
    status: { $in: ['awaiting_payment', 'payment_processing', 'paid', 'completed'] },
    checkinDate: { $lt: checkout },
    checkoutDate: { $gt: checkin }
  });
  return !!overlap;
}

function calculateCancellationFinancials(booking) {
  const checkInDate = new Date(booking.checkinDate);
  checkInDate.setHours(14, 0, 0, 0); 
  
  const now = new Date();
  
  const diffTime = checkInDate.getTime() - now.getTime();

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffTime < 0) diffDays = 0;

  const policy = booking.cancellationPolicy || {};
  const t3 = policy.t3DaysRefundPct || 90; 
  const t2 = policy.t2DaysRefundPct || 50; 
  const t1 = policy.t1DayRefundPct || 30; 

  let refundPercent = 0;

  
  if (diffDays >= 4) {
      refundPercent = 100;
  } else if (diffDays >= 3) {
      refundPercent = t3; 
  } else if (diffDays >= 2) {
      refundPercent = t2; 
  } else if (diffDays >= 1) {
      refundPercent = t1; 
  } else {
      refundPercent = 0; 
  }

  const totalPaid = booking.pricing.total;
  const refundAmount = Math.round((totalPaid * refundPercent) / 100);
  const retainedAmount = totalPaid - refundAmount;
  const PLATFORM_FEE_PERCENT = 5; 
  let newPlatformFee = 0;
  let newHostPayout = 0;

  if (retainedAmount > 0) {
      newPlatformFee = Math.round((retainedAmount * PLATFORM_FEE_PERCENT) / 100);
      newHostPayout = retainedAmount - newPlatformFee;
  }

  return { 
    diffDays,
    refundPercent, 
    refundAmount,     
    retainedAmount,
    newPlatformFee,   
    newHostPayout     
  };
}

export async function createBooking(req, res, next) {
  try {
    const body = createBookingSchema.parse(req.body); 
    const { promoCode } = req.body; 

    const listing = await Listing.findOne({ _id: body.listingId, status: 'approved' });
    if (!listing) return res.status(404).json({ message: 'Listing not found' });
    
    const ci = new Date(body.checkinDate);
    ci.setHours(14, 0, 0, 0);
    const co = new Date(body.checkoutDate);
    co.setHours(12, 0, 0, 0);
    const diffTime = co.getTime() - ci.getTime();
    const nights = Math.ceil(diffTime / (24*3600*1000));
    
    if (nights <= 0) {
      return res.status(400).json({ message: 'Ngày check-out phải sau ngày check-in' });
    }
    
    if (await isOverlapped(listing._id, ci, co)) {
      return res.status(409).json({ message: 'Ngày này đã có người đặt.' });
    }
    let pricing = computePricing(listing, nights);
    let discountAmount = 0;
    if (promoCode) {
        const promo = await Promotion.findOne({ 
            code: promoCode.toUpperCase(), 
            isActive: true,
            hostId: listing.hostId 
        });

        if (promo) {
            const now = new Date();
            const isValidDate = now >= new Date(promo.dateFrom) && now <= new Date(promo.dateTo);
            const isValidListing = !promo.listingIds.length || promo.listingIds.includes(listing._id);
            const isValidNights = !promo.minNights || nights >= promo.minNights;

            if (isValidDate && isValidListing && isValidNights) {
                if (promo.type === 'percent') {
                    discountAmount = (pricing.subtotal * promo.value) / 100;
                } else {
                    discountAmount = promo.value;
                }
                if (discountAmount > pricing.subtotal) discountAmount = pricing.subtotal; 
                discountAmount = Math.round(discountAmount);
            }
        }
    }
    pricing.discount = discountAmount;
    pricing.total = pricing.total - discountAmount;
    pricing.hostPayout = pricing.hostPayout - discountAmount; 
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
      promoCode: discountAmount > 0 ? promoCode : null, 
      cancellationPolicy: listing.cancellationPolicy,
      status: 'requested',
      contract: { previewHash },
      requestedAt: new Date()
    });
    const guestName = req.user.last_name || req.user.first_name || 'Khách';
    await Notification.create({
        userId: listing.hostId, 
        message: `Bạn nhận được yêu cầu đặt phòng mới từ ${guestName} cho nhà "${listing.title}".`,
        link: `/host/bookings?tab=requested`
    });

    res.status(201).json(doc);
  } catch (e) {
    if (e.code === 11000) {
        return res.status(409).json({ message: 'Dates conflict. Please try again.' });
    }
    next(e);
  }
}

export async function hostAccept(req, res, next) {
  try {
    const { expiresInMinutes } = hostDecisionSchema.parse(req.body ?? {});
    
    const b = await Booking.findOne({ _id: req.params.id, hostId: req.user._id, status: 'requested' });
    if (!b) return res.status(404).json({ message: 'Booking not found' });
    const orderCode = Date.now();
    let checkoutUrl = '';
    let qrData = '';
    let intentId = '';

    try {
        const payload = {
            orderCode: orderCode,
            amount: b.pricing.total,
            description: `TT Booking ${b._id.toString().slice(-8)}`,
            returnUrl: `${process.env.WEB_BASE_URL}/payment/success?orderCode=${orderCode}&bookingId=${b._id}`,
            cancelUrl: `${process.env.WEB_BASE_URL}/booking/${b._id}/pay`, 
        };

        const link = await payos.paymentRequests.create(payload);
        checkoutUrl = link?.checkoutUrl ?? '';
        qrData = link?.qrCode ?? '';
        intentId = link?.id ?? String(orderCode);

    } catch (payError) {
        console.error("Lỗi tạo link PayOS tại hostAccept:", payError);
        return res.status(500).json({ message: "Lỗi hệ thống thanh toán. Vui lòng thử lại." });
    }
    b.orderCode = String(orderCode);
    b.payment = {
        provider: 'payos',
        method: 'bank_qr',
        intentId,
        checkoutUrl,
        qrData,
        status: 'pending' 
    };

    b.status = 'awaiting_payment'; 
    b.hostRespondedAt = new Date();

    const expiryTime = expiresInMinutes ? (expiresInMinutes * 60 * 1000) : (60 * 60 * 1000);
    b.expiresAt = new Date(Date.now() + expiryTime);

    await b.save();
    Notification.create({
      userId: b.guestId,
      message: `Host đã chấp nhận yêu cầu! Vui lòng thanh toán ngay để giữ phòng.`,
      link: `/booking/${b._id}/pay` 
    });

    res.json({ 
        message: 'Accepted and payment link created', 
        expiresAt: b.expiresAt,
        checkoutUrl: b.payment.checkoutUrl 
    });

  } catch (e) { 
    next(e); 
  }
}
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

/** Webhook (PayOS) */
export async function paymentWebhook(req, res, next) {
  try {
    console.log("--- PayOS Webhook HIT ---");
    
    let body = req.body;
    if (Buffer.isBuffer(body) || typeof body === 'string') {
    }

    const validation = webhookSchema.safeParse(body);
    if (!validation.success) {
      console.warn("Webhook validation failed:", validation.error.errors);
      return res.json({ ok: true }); 
    }
    
    const data = validation.data.data;
    const code = validation.data.code;
    const orderCodeStr = String(data.orderCode); 

    const b = await Booking.findOne({ orderCode: orderCodeStr });
    if (!b) {
      console.warn(`Webhook: Booking not found for orderCode: ${orderCodeStr}`);
      return res.json({ ok: false, message: "Booking not found" });
    }

    if (b.status === 'paid') {
        return res.json({ ok: true, message: 'Already processed' });
    }

    if (code === '00') {
      console.log(`Webhook: Payment success for ${b._id}. Updating DB...`);
      
      b.payment.status = 'succeeded';
      b.payment.paidAt = new Date();
      b.payment.txns = b.payment.txns || [];
      b.payment.txns.push({
        providerTxnId: data.reference || 'N/A', 
        amount: b.pricing.total,
        status: 'succeeded',
        at: new Date(),
        raw: body
      });
      b.status = 'paid';

      try {
          const pdfRef = await renderAndStampContractPDF({ booking: b });
          b.contract = {
            ...(b.contract || {}),
            executedAt: new Date(),
            pdf: pdfRef
          };
      } catch (pdfErr) {
          console.error("Error generating PDF:", pdfErr);
      }

      await b.save();
      console.log(`Webhook: Updated booking ${b._id} to PAID.`);

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

    if (code !== '00') {
      b.payment.status = 'failed';
      await b.save();
    }
    
    res.json({ ok:true });
  } catch (e) { 
    console.error("Error in paymentWebhook:", e);
    res.status(200).json({ ok: true }); 
  }
}

export async function getBookingById(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('listingId', 'title photos address city') 
      .populate('hostId', 'first_name last_name picture phone email address cccdNumber host signature') 
      .populate('guestId', 'first_name last_name picture phone email address cccdNumber signature'); 

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    const user = req.user; 
    const isGuest = booking.guestId.equals(user._id);
    const isHost = booking.hostId.equals(user._id);
    const isAdmin = user.roles && user.roles.includes('admin'); 
    if (!isGuest && !isHost && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized to view this booking' });
    }

    res.json(booking);
  } catch (e) {
    next(e);
  }
}

export async function getBookingByOrderCode(req, res, next) {
  try {
    const booking = await Booking.findOne({ orderCode: req.params.orderCode })
      .populate('listingId', 'title photos address city')
      .populate('hostId', 'first_name last_name picture phone email address cccdNumber host signature') 
      .populate('guestId', 'first_name last_name picture phone email address cccdNumber signature');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    res.json(booking);
  } catch (e) {
    next(e);
  }
}
async function autoRejectOverdueBookings(userId, role) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const baseFilter = {
    checkinDate: { $lt: startOfToday } 
  };

  if (role === 'host') baseFilter.hostId = userId;
  else baseFilter.guestId = userId;

  await Booking.updateMany(
    { ...baseFilter, status: 'requested' },
    {
      $set: {
        status: 'host_rejected', 
        hostRespondedAt: new Date(),
        cancelReason: 'Hệ thống tự động từ chối: Đã quá ngày nhận phòng.'
      }
    }
  );
  await Booking.updateMany(
    { ...baseFilter, status: 'awaiting_payment' },
    {
      $set: {
        status: 'expired', 
        cancelledAt: new Date(),
        cancelReason: 'Hệ thống tự động hủy: Quá hạn thanh toán (Đã quá ngày nhận phòng).'
      }
    }
  );
}
export async function listMineGuest(req, res, next) {
  try {
    await autoRejectOverdueBookings(req.user._id, 'guest');

    const { status, limit=20, skip=0 } = req.query;
    const cond = { guestId: req.user._id };
    if (status) cond.status = status;
    
    const [items, total] = await Promise.all([
      Booking.find(cond)
        .populate('listingId', 'title photos address city') 
        .populate('hostId', 'first_name last_name picture') 
        .limit(Number(limit)).skip(Number(skip)).sort({ createdAt:-1 }),
      Booking.countDocuments(cond)
    ]);
    res.json({ items, total, limit:Number(limit), skip:Number(skip) });
  } catch (e) { next(e); }
}

export async function listMineHost(req, res, next) {
  try {
    await autoRejectOverdueBookings(req.user._id, 'host');

    const { status, limit=20, skip=0 } = req.query;
    const cond = { hostId: req.user._id };
    if (status) cond.status = status;
    
    const [items, total] = await Promise.all([
      Booking.find(cond)
        .populate('listingId', 'title photos address city') 
        .populate('guestId', 'first_name last_name picture') 
        .limit(Number(limit)).skip(Number(skip)).sort({ createdAt:-1 }),
      Booking.countDocuments(cond)
    ]);
    res.json({ items, total, limit:Number(limit), skip:Number(skip) });
  } catch (e) { next(e); }
}

export async function signBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { signature } = req.body; 

    if (!signature) {
      return res.status(400).json({ message: 'Chữ ký là bắt buộc' });
    }

    const booking = await Booking.findOne({ _id: id, guestId: req.user._id });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found or access denied' });
    }
    const base64Data = signature.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    const key = `signatures/booking-${id}-guest-${Date.now()}.png`;
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentEncoding: 'base64',
      ContentType: 'image/png',
    });

    await s3.send(command);

    const signatureData = {
      image: {
        bucket: bucket,
        region: region,
        key: key,
        url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
        contentType: 'image/png'
      },
      signedAt: new Date(),
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    if (!booking.contract) booking.contract = {};
    booking.contract.signedByGuest = signatureData;

    await booking.save();

    res.json({ message: 'Sign contract successfully', url: signatureData.image.url });

  } catch (e) {
    console.error("Error signing booking:", e);
    next(e);
  }
}
export const getHostDashboardCounts = async (req, res, next) => {
  try {
    const hostId = req.user._id;
    const pendingCount = await Booking.countDocuments({ 
        hostId, 
        status: 'requested' 
    });
    const upcomingCount = await Booking.countDocuments({ 
        hostId, 
        status: { $in: ['paid', 'awaiting_payment'] },
        checkinDate: { $gte: new Date() }
    });

    res.json({ 
        pendingBookings: pendingCount,
        upcomingBookings: upcomingCount
    });
  } catch (e) {
    next(e);
  }
};
export async function getUnavailableDates(req, res, next) {
  try {
    const { listingId } = req.params;
    const bookings = await Booking.find({
      listingId,
      status: { 
        $in: [
          'host_accepted',      
          'awaiting_payment',   
          'payment_processing', 
          'paid',               
          'completed'     
        ] 
      },
      checkoutDate: { $gte: new Date() } 
    }).select('checkinDate checkoutDate');
    res.json(bookings);
  } catch (e) {
    next(e);
  }
};

export async function cancelBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, bankName, accountNumber, accountHolder } = req.body; 
    const userId = req.user._id;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (!booking.guestId.equals(userId)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Cho phép hủy nếu đang chờ duyệt, chờ thanh toán, hoặc đã thanh toán
    if (!['requested', 'awaiting_payment', 'paid', 'host_accepted'].includes(booking.status)) {
      return res.status(400).json({ message: 'Không thể hủy đơn ở trạng thái này' });
    }
    if (booking.status !== 'paid') {
      booking.status = 'cancelled_by_guest';
      booking.cancelReason = reason || 'Guest cancelled';
      booking.cancelledAt = new Date();
      booking.pricing.hostPayout = 0;
      booking.pricing.platformFee = 0;
      
      await booking.save();
      await Notification.create({
        userId: booking.hostId,
        message: `Khách đã hủy yêu cầu đặt phòng #${booking.orderCode || booking._id.toString().slice(-6)}.`,
        link: `/host/bookings?tab=cancelled` 
      });

      return res.json({ message: 'Đã hủy yêu cầu đặt phòng thành công.' });
    } 
    
    else {
      // Bắt buộc phải có thông tin ngân hàng để hoàn tiền
      if (!bankName || !accountNumber || !accountHolder) {
         return res.status(400).json({ message: 'Vui lòng cung cấp thông tin ngân hàng để hoàn tiền.' });
      }
      const financials = calculateCancellationFinancials(booking);

      booking.status = 'refund_pending'; 
      booking.cancelReason = reason;
      booking.cancelledAt = new Date();
      
      booking.refund = {
          bankName,
          accountNumber,
          accountHolder,
          refundAmount: financials.refundAmount,
          refundReason: `Hủy trước ${financials.diffDays} ngày (Hoàn ${financials.refundPercent}%)`,
          status: 'pending'
      };

      // Cập nhật lại doanh thu thực nhận của Host sau khi trừ hoàn tiền
      booking.pricing.hostPayout = financials.newHostPayout;   
      booking.pricing.platformFee = financials.newPlatformFee; 

      await booking.save();
      
      // Thông báo cho Host (Về số tiền thực nhận thay đổi)
      await Notification.create({
        userId: booking.hostId,
        message: `Đơn ${booking.orderCode} đã bị khách hủy. Doanh thu thực nhận cập nhật: ${new Intl.NumberFormat('vi-VN').format(financials.newHostPayout)}đ`,
        link: `/host/bookings`
      });

      const refundAmountFormatted = new Intl.NumberFormat('vi-VN').format(financials.refundAmount);
      
      // Thông báo cho Admin để vào xử lý hoàn tiền
      const adminUser = await User.findOne({ roles: 'admin' }); 
      if (adminUser) {
        await Notification.create({
          userId: adminUser._id,
          message: `Yêu cầu hoàn tiền mới: ${refundAmountFormatted}đ cho đơn ${booking.orderCode}.`,
          link: `/admin/refunds`
        });
      }

      return res.json({ 
          message: `Yêu cầu hủy thành công. Số tiền hoàn dự kiến: ${refundAmountFormatted}đ. Admin sẽ xử lý sớm nhất.` 
      });
    }

  } catch (e) {
    next(e);
  }
};

export async function adminConfirmRefund(req, res, next) {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status !== 'refund_pending') {
        return res.status(400).json({ message: 'Đơn này không chờ hoàn tiền' });
    }
    booking.status = 'refunded';
    if (booking.refund) {
        booking.refund.status = 'completed';
        booking.refund.refundedAt = new Date();
    }

    await booking.save();

    await Notification.create({
      userId: booking.guestId,
      message: `Tài khoản ${booking.refund.bankName} - ${booking.refund.accountNumber} đã được hoàn tiền thành công.`,
      link: `/my-bookings`
    });

    res.json({ message: 'Xác nhận hoàn tiền thành công' });
  } catch (e) {
    next(e);
  }
}


