// import User from '../models/user.model.js';
// import RefreshToken from '../models/refreshToken.model.js';
// import {
//   hostApplySchema, hostKycSchema, hostPayoutDevSchema,
//   hostAgreementSchema, adminApproveHostSchema
// } from '../validators/host.schema.js';

// export async function getHostStatus(req, res) {
//   const u = req.user;
//   res.json({ roles: u.roles, host: u.host || null });
// }

// export async function applyHost(req, res, next) {
//   try {
//     hostApplySchema.parse(req.body || {});
//     const u = req.user;

//     if (u.roles.includes('host')) {
//       return res.json({ message: 'Already a host', status: 'approved' });
//     }

//     if (!u.host) u.host = {};
//     u.host.status = 'pending';
//     u.host.submittedAt = new Date();
//     u.host.reason = undefined;
//     u.host.onboardingSteps = u.host.onboardingSteps || {
//       kycSubmitted: false, payoutLinked: false, agreementSigned: false
//     };
//     await u.save();

//     res.json({ message: 'Host application created', status: u.host.status });
//   } catch (e) { next(e); }
// }

// export async function submitKyc(req, res, next) {
//   try {
//     const body = hostKycSchema.parse(req.body);
//     const u = req.user;
//     if (!u.host) return res.status(400).json({ message: 'No host application' });

//     u.host.kyc = {
//       fullName: body.fullName,
//       dob: body.dob,
//       address: body.address,
//       governmentId: { front: body.idFront, back: body.idBack }
//     };
//     u.host.onboardingSteps.kycSubmitted = true;
//     await u.save();

//     res.json({ message: 'KYC submitted' });
//   } catch (e) { next(e); }
// }

// // Dev/manual payout info (production dùng Stripe Connect)
// export async function linkPayoutDev(req, res, next) {
//   try {
//     const body = hostPayoutDevSchema.parse(req.body);
//     const u = req.user;
//     if (!u.host) return res.status(400).json({ message: 'No host application' });

//     u.host.payout = {
//       provider: 'manual',
//       bank: {
//         bankName: body.bankName,
//         accountHolder: body.accountHolder,
//         accountNumberMasked: body.accountNumberMasked
//       },
//       ready: true
//     };
//     u.host.onboardingSteps.payoutLinked = true;
//     await u.save();

//     res.json({ message: 'Payout linked (dev/manual)' });
//   } catch (e) { next(e); }
// }

// export async function signHostAgreement(req, res, next) {
//   try {
//     const body = hostAgreementSchema.parse(req.body);
//     const u = req.user;
//     if (!u.host) return res.status(400).json({ message: 'No host application' });

//     // dùng method attachSignature nếu muốn push vào signature chung
//     u.host.agreement = {
//       acceptedAt: new Date(),
//       signature: {
//         ...body.signature,
//         signedAt: new Date()
//       },
//       version: '2025-10-01'
//     };
//     u.host.onboardingSteps.agreementSigned = true;
//     await u.save();

//     res.json({ message: 'Agreement signed' });
//   } catch (e) { next(e); }
// }

// // Admin approve/reject
// export async function adminApproveHost(req, res, next) {
//   try {
//     const { userId, approve, reason } = adminApproveHostSchema.parse(req.body);
//     const u = await User.findById(userId);
//     if (!u?.host) return res.status(404).json({ message: 'Application not found' });

//     if (approve) {
//       u.host.status = 'approved';
//       u.host.approvedAt = new Date();
//       u.host.reason = undefined;
//       if (!u.roles.includes('host')) u.roles.push('host');

//       // Bảo mật: revoke refresh tokens cũ để phiên mới có role mới
//       await RefreshToken.updateMany(
//         { user: u._id, revokedAt: { $exists: false } },
//         { $set: { revokedAt: new Date() } }
//       );
//       await u.save();

//       res.json({ message: 'Approved', roles: u.roles });
//     } else {
//       u.host.status = 'rejected';
//       u.host.rejectedAt = new Date();
//       u.host.reason = reason || 'Not eligible';
//       await u.save();
//       res.json({ message: 'Rejected', reason: u.host.reason });
//     }
//   } catch (e) { next(e); }
// }

// src/controllers/host.controller.js
import User from '../models/user.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import {
  simpleHostOnboardingSchema,
  adminApproveHostSchema
} from '../validators/host.schema.js';

// === THÊM CÁC IMPORT ĐỂ UPLOAD S3 & CRYPTO ===
import { s3 } from '../config/s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto'; // Import crypto để tạo hash
// === KẾT THÚC IMPORT ===


// Hàm này vẫn hữu ích để FE kiểm tra
export async function getHostStatus(req, res) {
  const u = req.user;
  res.json({ roles: u.roles, host: u.host || null });
}

/**
 * [MỚI] Guest đăng ký host (Flow đơn giản)
 * Sửa lỗi: Tự động upload S3 VÀ fix lỗi validation (policyHash, acceptedAt)
 */
export async function submitHostOnboarding(req, res, next) {
  try {
    const body = simpleHostOnboardingSchema.parse(req.body);
    const u = req.user;

    if (u.roles.includes('host')) {
      return res.status(400).json({ message: 'Bạn đã là host.' });
    }

    const cccdExists = await User.exists({ "host.kyc.cccdNumber": body.cccdNumber });
    if (cccdExists) {
      return res.status(409).json({ 
        message: "Số CCCD này đã được đăng ký cho một tài khoản khác." 
      });
    }

    // 2. Upload chữ ký lên S3
    const base64Data = body.signature.image.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    const contentType = 'image/png';
    const key = `signatures/host-${u._id.toString()}-${uuidv4()}.png`;
    const s3Bucket = process.env.S3_BUCKET;
    const s3Region = process.env.S3_REGION;

    const command = new PutObjectCommand({
      Bucket: s3Bucket, Key: key, Body: buffer, ContentType: contentType,
    });
    await s3.send(command);

    const s3Url = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`;
    const signatureFileRef = {
      bucket: s3Bucket, region: s3Region, key: key, url: s3Url,
      contentType: contentType, size: buffer.length
    };

    // 6. Tạo đối tượng host
    if (!u.host) u.host = {};
    u.host.status = 'pending'; 
    u.host.submittedAt = new Date();
    u.host.reason = undefined;

    // 7. Lưu KYC
    u.host.kyc = {
      fullName: body.fullName,
      dob: body.dob,
      cccdNumber: body.cccdNumber
    };

    // 8. Lưu Payout
    u.host.payout = {
      provider: 'manual',
      bank: {
        bankName: body.bankName,
        accountHolder: body.accountHolder,
        accountNumberMasked: '****' + body.accountNumber.slice(-4)
      },
      ready: true
    };

    // === SỬA LỖI VALIDATION ===
    // 9. Tạo policyHash và consent đầy đủ
    const policyHash = crypto.createHash('sha256')
                             .update(body.signature.consent.policyVersion + body.signature.consent.policyKey)
                             .digest('hex');
    
    const completeConsent = {
      ...body.signature.consent,
      policyHash: policyHash, // Thêm policyHash
      acceptedAt: new Date()    // Thêm acceptedAt
    };

    // 10. Lưu Chữ Ký (với FileRefSchema từ S3)
    u.host.agreement = {
      acceptedAt: new Date(), // Cái này ở top-level (theo HostAgreementSchema)
      signature: {
        image: signatureFileRef, // <-- LƯU ĐỐI TƯỢNG S3
        consent: completeConsent, // <-- Dùng object đã bổ sung
        ip: body.signature.ip || req.ip,
        userAgent: body.signature.userAgent || req.headers['user-agent'],
        signedAt: new Date()
      },
      version: body.signature.consent.policyVersion
    };
    // === KẾT THÚC SỬA LỖI VALIDATION ===
    
    // 11. Cập nhật các bước
    u.host.onboardingSteps = {
      kycSubmitted: true,
      payoutLinked: true,
      agreementSigned: true
    };

    await u.save();

    res.status(201).json({ 
      message: 'Đăng ký host thành công! Yêu cầu của bạn đang chờ quản trị viên duyệt.', 
      status: u.host.status 
    });

  } catch (e) {
    next(e);
  }
}

// Admin approve/reject (Vẫn giữ nguyên)
export async function adminApproveHost(req, res, next) {
  try {
    const { userId, approve, reason } = adminApproveHostSchema.parse(req.body);
    const u = await User.findById(userId);
    if (!u?.host) return res.status(404).json({ message: 'Application not found' });

    if (approve) {
      u.host.status = 'approved';
      u.host.approvedAt = new Date();
      u.host.reason = undefined;
      if (!u.roles.includes('host')) u.roles.push('host');

      await RefreshToken.updateMany(
        { user: u._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );
      await u.save();

      res.json({ message: 'Approved', roles: u.roles });
    } else {
      u.host.status = 'rejected';
      u.host.rejectedAt = new Date();
      u.host.reason = reason || 'Not eligible';
      await u.save();
      res.json({ message: 'Rejected', reason: u.host.reason });
    }
  } catch (e) { next(e); }
}