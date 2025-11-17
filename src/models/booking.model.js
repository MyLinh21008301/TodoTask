import mongoose from 'mongoose';
const { Schema } = mongoose;

const FileRef = new Schema({
  bucket: String, region: String, key: String, url: String,
  contentType: String, size: Number
}, { _id:false });

const ConsentSnapshot = new Schema({
  policyKey: String, policyVersion: String, policyHash: String,
  acceptedAt: Date, locale: { type: String, default: 'vi-VN' }
}, { _id:false });

const Signature = new Schema({
  image: FileRef,
  strokesJson: String,
  dataHash: String,
  consent: ConsentSnapshot,
  signedAt: Date,
  ip: String,
  userAgent: String,
  device: String
}, { _id:false });

const BookingSchema = new Schema({
  guestId:   { type: Schema.Types.ObjectId, ref:'User', required: true, index: true },
  hostId:    { type: Schema.Types.ObjectId, ref:'User', required: true, index: true },
  listingId: { type: Schema.Types.ObjectId, ref:'Listing', required: true, index: true },
  unitId:    { type: Schema.Types.ObjectId, ref:'ListingUnit' },

  orderCode: { type: String, index: true, unique: true, sparse: true },

  status: {
    type: String,
    enum: [
      'requested',
      'host_accepted', // Giữ lại để có thể dùng trong tương lai, dù luồng hiện tại bỏ qua
      'host_rejected',
      'expired',
      'awaiting_payment',
      'payment_processing',
      'paid',
      'completed',
      'cancelled_by_guest',
      'cancelled_by_host',
      'refund_pending',
      'refunded'
    ],
    default: 'requested',
    index: true
  },

  checkinDate:  { type: Date, required: true, index: true },
  checkoutDate: { type: Date, required: true, index: true },
  nights:       { type: Number, required: true, min: 1 },
  guestCount:   { type: Number, default: 1, min: 1 },

  pricing: {
    currency:  { type: String, default: 'VND' },
    basePricePerNight: Number,
    fees: {
      cleaning: { type: Number, default: 0 },
      service:  { type: Number, default: 0 }
    },
    taxPct:  { type: Number, default: 0 },
    subtotal: Number,
    platformFee: Number,
    total:    Number,
    hostPayout: Number
  },

  cancellationPolicy: {
    t3DaysRefundPct: Number,
    t2DaysRefundPct: Number,
    t1DayRefundPct: Number
  },

  payment: {
    provider: { type: String, enum: ['payos','vietqr','none'], default: 'none' },
    method:   { type: String, enum: ['bank_qr','card','none'], default: 'bank_qr' },
    intentId: String,
    checkoutUrl: String,
    qrData: String,
    status:  { type: String, enum: ['none','pending','succeeded','failed','refunded'], default: 'none' },
    paidAt:  Date,
    txns: [{
      providerTxnId: String,
      amount: Number,
      status: String,
      at: Date,
      raw: Schema.Types.Mixed
    }]
  },

  contract: {
    previewHash: String,
    signedByGuest: Signature,
    signedByHost: Signature,
    executedAt: Date,
    pdf: FileRef
  },

  expiresAt: Date,

  requestedAt: { type: Date, default: Date.now },
  hostRespondedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String
}, { timestamps: true });

BookingSchema.index({ guestId:1, status:1, createdAt:-1 });
BookingSchema.index({ hostId:1, status:1, createdAt:-1 });

BookingSchema.index(
  {
    listingId: 1,
    checkinDate: 1,
    checkoutDate: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['awaiting_payment', 'payment_processing', 'paid', 'completed'] }
    }
  }
);


const Booking = mongoose.model('Booking', BookingSchema);
export default Booking;