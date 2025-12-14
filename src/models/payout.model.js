// src/models/payout.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;
const PayoutBatchSchema = new Schema({
  month: { type: Number, required: true }, 
  year: { type: Number, required: true },  
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  
  totalGmv: { type: Number, default: 0 },         
  totalPlatformFee: { type: Number, default: 0 }, 
  totalPayout: { type: Number, default: 0 }, 
  
  status: { 
    type: String, 
    enum: ['processing', 'completed'], 
    default: 'processing' 
  },
  paidCount: { type: Number, default: 0 },      
  totalSettlements: { type: Number, default: 0 } // Tổng số host cần trả trong đợt này
}, { timestamps: true });

const HostSettlementSchema = new Schema({
  batchId: { type: Schema.Types.ObjectId, ref: 'PayoutBatch', required: true },
  hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  bankSnapshot: {
    bankName: String,
    accountHolder: String,
    accountNumber: String 
  },

  totalBookings: { type: Number, default: 0 },
  totalNetRevenue: { type: Number, required: true }, 
  platformFee: { type: Number, required: true },    
  payoutAmount: { type: Number, required: true },   
  
  status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  paidAt: { type: Date }
}, { timestamps: true });

export const PayoutBatch = mongoose.model('PayoutBatch', PayoutBatchSchema);
export const HostSettlement = mongoose.model('HostSettlement', HostSettlementSchema);