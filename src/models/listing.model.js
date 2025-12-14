// src/models/listing.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const MoneySchema = new Schema({
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'VND' }
}, { _id: false });

const FeesSchema = new Schema({
  cleaning: { type: Number, default: 0, min: 0 },
  service:  { type: Number, default: 0, min: 0 },
  taxPct:   { type: Number, default: 0, min: 0, max: 100 }
}, { _id: false });

const AddressSchema = new Schema({
  line1: String,
  ward: String,
  district: String,
  city: String
}, { _id: false });

const RoomDetailsSchema = new Schema({
  bedrooms: { type: Number, default: 1 },
  livingRooms: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 1 }
}, { _id: false });

const AdminApprovalSchema = new Schema({
  status: { type: String, enum: ['pending_review','approved','rejected'], default: 'pending_review' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  note: String
}, { _id: false });

// <<< 1. SCHEMA REVIEW (MỚI) >>>
const ReviewSchema = new Schema({
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
  guestId:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const ListingSchema = new Schema({
  hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  description: String,

  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      validate: v => (!v || v.length === 2),
      index: '2dsphere'
    }
  },
  address: AddressSchema,
  citySlug: { type: String, index: true },
  roomDetails: { type: RoomDetailsSchema, default: () => ({}) },
  amenities: [String],
  photos: [{ s3Key: String, url: String }],
  basePrice: MoneySchema,
  fees: FeesSchema,
  unitsCount: { type: Number, default: 1, min: 1 },

  cancellationPolicy: {
    t3DaysRefundPct: { type: Number, default: 90, min: 0, max: 100 },
    t2DaysRefundPct: { type: Number, default: 50, min: 0, max: 100 },
    t1DayRefundPct: { type: Number, default: 30, min: 0, max: 100 }
  },

  status: {
    type: String,
    enum: ['draft','pending_review','approved','rejected','archived','suspended'],
    default: 'pending_review',
    index: true
  },
  adminApproval: { type: AdminApprovalSchema, default: { status: 'pending_review' } },

  // <<< 2. NHÚNG REVIEW VÀO LISTING >>>
  reviews: [ReviewSchema], 
  averageRating: { type: Number, default: 0, index: true },
  reviewCount:   { type: Number, default: 0 },

}, { timestamps: true });

ListingSchema.index({ status: 1, citySlug: 1, 'basePrice.amount': 1 });
const Listing = mongoose.model('Listing', ListingSchema);

export default Listing;