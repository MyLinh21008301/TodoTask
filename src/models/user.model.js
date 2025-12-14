//src/models/user.model.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const { Schema } = mongoose;

// OTP xác thực email
const EmailVerificationSchema = new Schema({
  codeHash: String,          
  expiresAt: Date,            
  attempts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  lastSentAt: Date            
}, { _id: false });

const PasswordResetSchema = new Schema({
  codeHash: String,
  expiresAt: Date,
  attempts: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  lastSentAt: Date,
  verifiedAt: Date,
  sessionJti: String,         // định danh phiên reset
  sessionExpiresAt: Date
}, { _id: false });

// Google link
const GoogleSubSchema = new Schema({
  id: { type: String, sparse: true }, // Google "sub"
  email: { type: String, lowercase: true, trim: true },
  picture: String,
  linkedAt: Date
}, { _id: false });

const ConsentSnapshotSchema = new Schema({
  policyKey: { type: String, required: true },
  policyVersion: { type: String, required: true },
  policyHash: { type: String, required: true },
  acceptedAt: { type: Date, required: true },
  locale: { type: String, default: 'vi-VN' }
}, { _id: false });

const FileRefSchema = new Schema({
  bucket: String,
  region: String,
  key: String,
  url: String,
  contentType: String,
  size: Number,
  width: Number,
  height: Number
}, { _id: false });

// Chữ ký tay điện tử
const SignatureSchema = new Schema({
  image: FileRefSchema,         // ảnh render từ strokes
  strokesJson: { type: String },
  dataHash: { type: String },
  consent: ConsentSnapshotSchema,
  signedAt: { type: Date, required: true },
  ip: String,
  userAgent: String,
  device: String               
}, { _id: true, timestamps: false });



const HostKycSchema = new Schema({
  fullName: String,
  dob: String,                  
  phoneVerifiedAt: Date,
  governmentId: {
    front: FileRefSchema,
    back: FileRefSchema
  },
  address: {
    country: String,
    city: String,
    line1: String,
    postalCode: String
  },
  verifiedAt: Date,
  notes: String,
  cccdNumber: String
}, { _id: false });

const HostPayoutSchema = new Schema({
  provider: { type: String, enum: ['stripe', 'manual', 'none'], default: 'none' },

  // Stripe Connect (production)
  stripe: {
    accountId: String,                     // acct_...
    capabilities: { type: Schema.Types.Mixed }, // snapshot object từ Stripe
    requirementsDue: [String],
    updatedAt: Date
  },

  // Manual payout (dev/test) – không lưu số thật
  bank: {
    bankName: String,
    accountHolder: String,
    accountNumberMasked: String            // chỉ lưu dạng ****1234
  },

  ready: { type: Boolean, default: false } // đủ điều kiện nhận tiền?
}, { _id: false });

const HostAgreementSchema = new Schema({
  acceptedAt: Date,
  signature: SignatureSchema,  // tái dùng e-signature
  version: String              // version điều khoản host
}, { _id: false });

const HostProfileSchema = new Schema({
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reason: String,
  kyc: HostKycSchema,
  payout: HostPayoutSchema,
  agreement: HostAgreementSchema,
  onboardingSteps: {
    kycSubmitted: { type: Boolean, default: false },
    payoutLinked: { type: Boolean, default: false },
    agreementSigned: { type: Boolean, default: false }
  },
  submittedAt: Date,
  approvedAt: Date,
  rejectedAt: Date
}, { _id: false });

const AddressSchema = new Schema({
  line1: String,    // Số nhà, tên đường
  ward: String,     // Phường/Xã
  district: String, // Quận/Huyện
  city: String      // Tỉnh/Thành phố
}, { _id: false });

export const ROLES = ['guest', 'host', 'admin'];
export const USER_STATUS = ['pending', 'active', 'suspended', 'deleted'];


const UserSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  emailVerifiedAt: { type: Date },

  emailVerification: { type: EmailVerificationSchema, default: {} },
  passwordReset:     { type: PasswordResetSchema,     default: {} },

  first_name: String,
  last_name: String,
  picture: String,

  // === THÊM TRƯỜNG CCCD VÀO ĐÂY ===
  cccdNumber: { type: String, index: true, sparse: true, unique: true },
  // === KẾT THÚC THÊM ===

  gender: {
    type: String,
    enum: ['male', 'female', 'other'] 
  },
  phone: { type: String },
  dob: { type: Date },
  address: AddressSchema,
  
  // Đăng nhập local / Google
  passwordHash: { type: String }, 
  auth: {
    local:  { enabled: { type: Boolean, default: false } },
    google: GoogleSubSchema
  },

  roles:  { type: [String], enum: ROLES, default: ['guest'] },
  status: { type: String, enum: USER_STATUS, default: 'pending' },

  host: { type: HostProfileSchema, default: null },

  // E-Signature
  signature: {
    current: SignatureSchema,     
    history: [SignatureSchema]    
  },

  wishlist: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'Listing' 
  }],

  lastLoginAt: Date,
  lastLoginIp: String,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ 'auth.google.id': 1 }, { unique: true, sparse: true });
UserSchema.index({ phone: 1 }, { unique: true, sparse: true });

// Hỗ trợ truy vấn host/payout
UserSchema.index({ 'host.status': 1 }, { sparse: true });
UserSchema.index({ 'host.payout.ready': 1 }, { sparse: true });
UserSchema.index({ 'host.payout.stripe.accountId': 1 }, { unique: false, sparse: true });

UserSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
  this.auth = this.auth || {};
  this.auth.local = this.auth.local || {};
  this.auth.local.enabled = true;
};

UserSchema.methods.comparePassword = async function (plain) {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);

};

// Gắn chữ ký tay làm current + đẩy history
UserSchema.methods.attachSignature = function (payload = {}) {
  const { image, strokesJson, consent, ip, userAgent, device, locationHint } = payload;
  const hashBase = strokesJson ?? JSON.stringify(image ?? {});
  const dataHash = crypto.createHash('sha256').update(hashBase).digest('hex');

  const sig = {
    image, strokesJson, dataHash, consent,
    signedAt: new Date(), ip, userAgent, device, locationHint
  };

  if (this.signature?.current) {
    this.signature.history = this.signature.history || [];
    this.signature.history.unshift(this.signature.current);
  }
  this.signature.current = sig;
};

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    if (ret.emailVerification) delete ret.emailVerification.codeHash;
    if (ret.passwordReset)     delete ret.passwordReset.codeHash;
    return ret;
  }
});

const User = mongoose.model('User', UserSchema);
export default User;