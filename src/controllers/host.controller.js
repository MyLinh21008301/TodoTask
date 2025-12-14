// src/controllers/host.controller.js
import User from '../models/user.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import {
  simpleHostOnboardingSchema,
  adminApproveHostSchema
} from '../validators/host.schema.js';
import { PayoutBatch, HostSettlement } from '../models/payout.model.js';

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
export async function getMyPayoutStats(req, res, next) {
  try {
    const hostId = req.user._id;

    // 1. Lấy tất cả các khoản thanh toán (Settlement) của Host này
    // Sắp xếp mới nhất lên đầu để dễ nhìn
    const settlements = await HostSettlement.find({ hostId })
      .populate('batchId', 'month year fromDate toDate') // Lấy thông tin tháng/năm từ Batch cha
      .sort({ createdAt: -1 });

    // 2. Phân loại dữ liệu để trả về Frontend
    let nextPayoutAmount = 0; // Số tiền sắp nhận (đang pending)
    const history = [];

    for (const item of settlements) {
      const batch = item.batchId;
      if (!batch) continue;

      // Format dữ liệu lịch sử
      history.push({
        id: item._id,
        // Hiển thị tên kỳ thanh toán: "Tháng 10/2023"
        batchName: `Tháng ${batch.month}/${batch.year}`,
        period: `${new Date(batch.fromDate).toLocaleDateString('vi-VN')} - ${new Date(batch.toDate).toLocaleDateString('vi-VN')}`,
        amount: item.payoutAmount, // Số tiền thực nhận (đã trừ phí)
        status: item.status,       // 'pending' hoặc 'paid'
        paidAt: item.paidAt,       // Ngày Admin chuyển khoản (nếu có)
        totalBookings: item.totalBookings // Số đơn trong kỳ này
      });

      // Nếu đang pending -> Cộng dồn vào "Sắp thanh toán"
      // (Thường mỗi tháng chỉ có 1 settlement pending, nhưng cộng dồn cho chắc)
      if (item.status === 'pending') {
        nextPayoutAmount += item.payoutAmount;
      }
    }

    res.json({
      nextPayout: nextPayoutAmount,
      history: history
    });

  } catch (e) {
    next(e);
  }
}
export const getHostRevenueStats = async (req, res, next) => {
  try {
    const hostId = req.user._id;
    // Lấy năm từ request, nếu không có thì lấy năm hiện tại
    const selectedYear = parseInt(req.query.year) || new Date().getFullYear();

    const projectNetRevenue = {
        $project: {
          year: { $year: "$checkoutDate" },
          month: { $month: "$checkoutDate" },
          // Công thức tính tiền thực nhận (95% của Net Revenue)
          netPayout: { 
             $multiply: [
               { $subtract: ["$pricing.total", { $ifNull: ["$refund.refundAmount", 0] }] },
               0.95 
             ]
          }
        }
    };

    const matchStage = {
      hostId: hostId,
      status: { $in: ['paid', 'completed', 'refunded', 'cancelled_by_guest', 'cancelled_by_host'] },
      checkoutDate: { $exists: true }
    };

    const stats = await Booking.aggregate([
      { $match: matchStage },
      projectNetRevenue,
      {
         $facet: {
            // 1. Lấy danh sách TẤT CẢ các năm có doanh thu (để làm Dropdown)
            availableYears: [
               { $group: { _id: "$year" } },
               { $sort: { _id: -1 } } // Năm mới nhất lên đầu
            ],
            // 2. Tính tổng doanh thu CỦA NĂM ĐƯỢC CHỌN
            totalForYear: [
               { $match: { year: selectedYear } },
               { $group: { _id: null, total: { $sum: "$netPayout" }, count: { $sum: 1 } } }
            ],
            // 3. Biểu đồ theo tháng CỦA NĂM ĐƯỢC CHỌN
            monthly: [
               { $match: { year: selectedYear } },
               {
                 $group: {
                   _id: "$month", 
                   revenue: { $sum: "$netPayout" },
                   count: { $sum: 1 }
                 }
               },
               { $sort: { _id: 1 } }
            ]
         }
      }
    ]);

    const availableYears = stats[0].availableYears.map(y => y._id);
    // Nếu chưa có năm nào, mặc định trả về năm nay
    if (availableYears.length === 0) availableYears.push(new Date().getFullYear());

    const totalData = stats[0].totalForYear[0] || { total: 0, count: 0 };
    const monthlyData = stats[0].monthly || [];

    // Format dữ liệu biểu đồ (đủ 12 tháng)
    const chartData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const found = monthlyData.find(m => m._id === month);
      return {
        name: `T${month}`,
        revenue: found ? Math.round(found.revenue) : 0,
        bookings: found ? found.count : 0
      };
    });

    res.json({
      selectedYear,
      availableYears, // Danh sách năm [2025, 2024...]
      totalRevenue: Math.round(totalData.total), // Tổng của năm chọn
      totalBookings: totalData.count,
      chartData
    });

  } catch (e) {
    next(e);
  }
};