import Booking from '../models/booking.model.js';
import Listing from '../models/listing.model.js';
import {
  createBookingSchema, hostDecisionSchema, initiatePaySchema, webhookSchema
} from '../validators/booking.schema.js';
import crypto from 'crypto';

// Tính giá 
function computePricing(listing, nights) {
  const base = Math.round(listing.basePrice?.amount || 0);
  const cleaning = listing.fees?.cleaning || 0;
  const service  = listing.fees?.service  || 0;
  const taxPct   = listing.fees?.taxPct   || 0;

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

// Kiểm tra trùng đặt phòng
async function isOverlapped(listingId, checkin, checkout) {
  const overlap = await Booking.exists({
    listingId,
    status: { $in: ['host_accepted','awaiting_payment','payment_processing','paid','completed'] },
    $or: [
      { checkinDate: { $lt: checkout }, checkoutDate: { $gt: checkin } }
    ]
  });
  return !!overlap;
}

/** GUEST: tạo yêu cầu đặt */
export async function createBooking(req,res,next){
  try{
    const body = createBookingSchema.parse(req.body);
    const listing = await Listing.findOne({ _id: body.listingId, status:'approved' });
    if(!listing) return res.status(404).json({ message:'Listing not found' });

    const ci = new Date(body.checkinDate);
    const co = new Date(body.checkoutDate);
    const nights = Math.ceil((co - ci)/(24*3600*1000));
    if (isNaN(ci) || isNaN(co) || nights <= 0) {
      return res.status(400).json({ message:'Invalid dates' });
    }

    // tránh double-book
    if(await isOverlapped(listing._id, ci, co))
      return res.status(409).json({ message:'Dates already booked' });

    const pricing = computePricing(listing, nights);

    const doc = await Booking.create({
      guestId: req.user._id,
      hostId: listing.hostId,
      listingId: listing._id,
      checkinDate: ci, checkoutDate: co, nights,
      guestCount: body.guestCount,
      pricing,
      cancellationPolicy: listing.cancellationPolicy,
      status: 'requested',
      requestedAt: new Date()
    });
    res.status(201).json(doc);
  }catch(e){ next(e); }
}

/** HOST: chấp nhận (chuyển sang awaiting_payment + expiresAt) */
export async function hostAccept(req,res,next){
  try{
    const { expiresInMinutes } = hostDecisionSchema.parse(req.body ?? {});
    const b = await Booking.findOne({ _id:req.params.id, hostId:req.user._id, status:'requested' });
    if(!b) return res.status(404).json({ message:'Booking not found' });

    b.status='awaiting_payment';
    b.expiresAt = new Date(Date.now() + expiresInMinutes*60*1000);
    b.hostRespondedAt = new Date();
    await b.save();
    res.json({ message:'Accepted, awaiting payment', expiresAt: b.expiresAt });
  }catch(e){ next(e); }
}

/** HOST: từ chối */
export async function hostDecline(req,res,next){
  try{
    const b = await Booking.findOne({ _id:req.params.id, hostId:req.user._id, status:'requested' });
    if(!b) return res.status(404).json({ message:'Booking not found' });
    b.status='host_rejected';
    b.hostRespondedAt=new Date();
    await b.save();
    res.json({ message:'Declined' });
  }catch(e){ next(e); }
}

/** GUEST: khởi tạo thanh toán (mock PayOS/VietQR) */
export async function initiatePayment(req,res,next){
  try{
    const { provider, method } = initiatePaySchema.parse(req.body ?? {});
    const b = await Booking.findOne({ _id:req.params.id, guestId:req.user._id });
    if(!b) return res.status(404).json({ message:'Booking not found' });

    if(b.status !== 'awaiting_payment')
      return res.status(400).json({ message:'Not payable' });

    if(b.expiresAt && b.expiresAt < new Date()) {
      b.status='expired'; await b.save();
      return res.status(400).json({ message:'Booking expired' });
    }

    // TODO: gọi SDK PayOS/VietQR thật. Ở đây mock:
    const intentId = provider + '_' + crypto.randomBytes(6).toString('hex');
    const checkoutUrl = `https://pay.example/checkout/${intentId}`;
    const qrData = `PAY|${intentId}|${b.pricing.total}`;

    b.payment = {
      provider, method, intentId, checkoutUrl, qrData,
      status:'pending'
    };
    await b.save();

    res.json({
      amount: b.pricing.total,
      currency: b.pricing.currency,
      provider, method, intentId, checkoutUrl, qrData
    });
  }catch(e){ next(e); }
}

/** Webhook (thay bằng verify chữ ký HMAC cổng thanh toán) */
export async function paymentWebhook(req,res,next){
  try{
    const body = webhookSchema.parse(req.body);
    // TODO: verify HMAC header trước khi xử lý
    const b = await Booking.findOne({ 'payment.intentId': body.intentId });
    if(!b) return res.status(404).json({ ok:false });

    if(body.status === 'succeeded'){
      b.payment.status = 'succeeded';
      b.payment.paidAt = new Date();
      b.payment.txns = b.payment.txns || [];
      b.payment.txns.push({
        providerTxnId: body.providerTxnId || '',
        amount: b.pricing.total, status:'succeeded', at: new Date(), raw: req.body
      });
      b.status = 'paid';
      b.contract = b.contract || {};
      b.contract.executedAt = new Date(); // hợp đồng có hiệu lực
      await b.save();
      return res.json({ ok:true });
    }

    if(body.status === 'failed'){
      b.payment.status = 'failed';
      await b.save();
      return res.json({ ok:true });
    }

    if(body.status === 'refunded'){
      b.payment.status = 'refunded';
      b.status = 'refunded';
      await b.save();
      return res.json({ ok:true });
    }

    res.json({ ok:true });
  }catch(e){ next(e); }
}

/** Guest xem đơn của mình */
export async function listMineGuest(req,res,next){
  try{
    const { status, limit=20, skip=0 } = req.query;
    const cond = { guestId: req.user._id };
    if (status) cond.status = status;
    const items = await Booking.find(cond).limit(Number(limit)).skip(Number(skip)).sort({ createdAt:-1 });
    const total = await Booking.countDocuments(cond);
    res.json({ items, total, limit:Number(limit), skip:Number(skip) });
  }catch(e){ next(e); }
}

/** Host xem yêu cầu của mình */
export async function listMineHost(req,res,next){
  try{
    const { status, limit=20, skip=0 } = req.query;
    const cond = { hostId: req.user._id };
    if (status) cond.status = status;
    const items = await Booking.find(cond).limit(Number(limit)).skip(Number(skip)).sort({ createdAt:-1 });
    const total = await Booking.countDocuments(cond);
    res.json({ items, total, limit:Number(limit), skip:Number(skip) });
  }catch(e){ next(e); }
}
