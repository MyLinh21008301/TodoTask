
import { PayOS } from '@payos/node';
export const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

export function verifyPayOSSignature({ rawBody, signatureHeader }) {
    if (!process.env.PAYOS_CHECKSUM_KEY || !signatureHeader) return false;
    const h = crypto
      .createHmac('sha256', process.env.PAYOS_CHECKSUM_KEY)
      .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody)))
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(String(signatureHeader)));
    } catch {
      return false;
    }
  }