import mongoose from 'mongoose';

const { Schema } = mongoose;

const RefreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true }, // hash của refresh token
    userAgent: String,
    ip: String,
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: Date
  },
  { timestamps: true }
);

// Tự xoá khi quá hạn (TTL) – tùy bạn có dùng hay không (Atlas TTL index theo expiresAt)
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken = mongoose.model('RefreshToken', RefreshTokenSchema);
export default RefreshToken;
