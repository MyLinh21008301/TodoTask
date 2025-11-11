// services/contract.service.js
import crypto from 'crypto';
// import PDFKit / puppeteer / sharp ... tuỳ bạn
// import { uploadToS3 } from '../lib/s3.js';

export async function buildContractPreviewHash(booking) {
  const raw = JSON.stringify({
    listingId: booking.listingId,
    guestId: booking.guestId,
    hostId: booking.hostId,
    checkin: booking.checkinDate,
    checkout: booking.checkoutDate,
    pricing: booking.pricing
  });
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export async function renderAndStampContractPDF({ booking, guestSig, hostSig }) {
  const fileRef = {
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
    key: `contracts/${booking._id}.pdf`,
    url: `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/contracts/${booking._id}.pdf`,
    contentType: 'application/pdf',
    size: 12345
  };
  return fileRef;
}
