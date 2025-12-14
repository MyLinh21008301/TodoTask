// src/models/promotion.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const PromotionSchema = new Schema({
  hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  listingIds: [{ type: Schema.Types.ObjectId, ref: 'Listing' }], 

  title: { type: String, required: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ['percent', 'amount'], default: 'percent' },
  value: { type: Number, required: true, min: 0 },
  minNights: { type: Number, default: 0 },
  dateFrom: { type: Date, required: true },
  dateTo:   { type: Date, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

PromotionSchema.index({ code: 1 });
const Promotion = mongoose.model('Promotion', PromotionSchema);
export default Promotion;