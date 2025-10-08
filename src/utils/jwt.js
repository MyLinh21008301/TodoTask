import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import RefreshToken from '../models/refreshToken.model.js';

const ACC_SECRET = process.env.JWT_ACCESS_SECRET;
const REF_SECRET = process.env.JWT_REFRESH_SECRET;
const ACC_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REF_TTL = process.env.REFRESH_TOKEN_TTL || '30d';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), roles: user.roles },
    ACC_SECRET,
    { expiresIn: ACC_TTL }
  );
}

// Tạo + lưu refresh token (hash vào DB)
export async function issueRefreshToken(user, meta = {}) {
  const jti = uuid();
  const raw = jwt.sign(
    { sub: String(user._id), jti },
    REF_SECRET,
    { expiresIn: REF_TTL }
  );
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');

  const now = new Date();
  const expMs = jwt.decode(raw).exp * 1000;
  const doc = await RefreshToken.create({
    user: user._id,
    tokenHash,
    userAgent: meta.userAgent,
    ip: meta.ip,
    expiresAt: new Date(expMs)
  });
  return { raw, doc };
}

export async function revokeRefreshToken(raw) {
  if (!raw) return;
  const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}

export function verifyAccess(raw) {
  return jwt.verify(raw, ACC_SECRET);
}

export function verifyRefresh(raw) {
  return jwt.verify(raw, REF_SECRET);
}
