// src/controllers/host.controller.js
import User from '../models/user.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import {
  simpleHostOnboardingSchema,
  adminApproveHostSchema
} from '../validators/host.schema.js';
import { PayoutBatch, HostSettlement } from '../models/payout.model.js';

import { s3 } from '../config/s3.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto'; 
import Booking from '../models/booking.model.js';


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

    if (!u.host) u.host = {};
    u.host.status = 'pending'; 
    u.host.submittedAt = new Date();
    u.host.reason = undefined;

    u.host.kyc = {
      fullName: body.fullName,
      dob: body.dob,
      cccdNumber: body.cccdNumber
    };

    u.host.payout = {
      provider: 'manual',
      bank: {
        bankName: body.bankName,
        accountHolder: body.accountHolder,
        accountNumberMasked: '****' + body.accountNumber.slice(-4)
      },
      ready: true
    };

    const policyHash = crypto.createHash('sha256')
                             .update(body.signature.consent.policyVersion + body.signature.consent.policyKey)
                             .digest('hex');
    
    const completeConsent = {
      ...body.signature.consent,
      policyHash: policyHash, 
      acceptedAt: new Date()    
    };

    u.host.agreement = {
      acceptedAt: new Date(), 
      signature: {
        image: signatureFileRef, 
        consent: completeConsent, 
        ip: body.signature.ip || req.ip,
        userAgent: body.signature.userAgent || req.headers['user-agent'],
        signedAt: new Date()
      },
      version: body.signature.consent.policyVersion
    };
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
    const settlements = await HostSettlement.find({ hostId })
      .populate('batchId', 'month year fromDate toDate') // Lấy thông tin tháng/năm từ Batch cha
      .sort({ createdAt: -1 });
    let nextPayoutAmount = 0;
    const history = [];

    for (const item of settlements) {
      const batch = item.batchId;
      if (!batch) continue;

      history.push({
        id: item._id,
        batchName: `Tháng ${batch.month}/${batch.year}`,
        period: `${new Date(batch.fromDate).toLocaleDateString('vi-VN')} - ${new Date(batch.toDate).toLocaleDateString('vi-VN')}`,
        amount: item.payoutAmount, 
        status: item.status,       
        paidAt: item.paidAt,   
        totalBookings: item.totalBookings 
      });
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
// export const getHostRevenueStats = async (req, res, next) => {
//   try {
//     const hostId = req.user._id;
//     const selectedYear = parseInt(req.query.year) || new Date().getFullYear();

//     const projectNetRevenue = {
//         $project: {
//           year: { $year: "$checkoutDate" },
//           month: { $month: "$checkoutDate" },
//           // Công thức tính tiền thực nhận (95% của Net Revenue)
//           netPayout: { 
//              $multiply: [
//                { $subtract: ["$pricing.total", { $ifNull: ["$refund.refundAmount", 0] }] },
//                0.95 
//              ]
//           }
//         }
//     };

//     const matchStage = {
//       hostId: hostId,
//       status: { $in: ['paid', 'completed', 'refunded', 'cancelled_by_guest', 'cancelled_by_host'] },
//       checkoutDate: { $exists: true }
//     };

//     const stats = await Booking.aggregate([
//       { $match: matchStage },
//       projectNetRevenue,
//       {
//          $facet: {
//             // 1. Lấy danh sách TẤT CẢ các năm có doanh thu (để làm Dropdown)
//             availableYears: [
//                { $group: { _id: "$year" } },
//                { $sort: { _id: -1 } } // Năm mới nhất lên đầu
//             ],
//             // 2. Tính tổng doanh thu CỦA NĂM ĐƯỢC CHỌN
//             totalForYear: [
//                { $match: { year: selectedYear } },
//                { $group: { _id: null, total: { $sum: "$netPayout" }, count: { $sum: 1 } } }
//             ],
//             // 3. Biểu đồ theo tháng CỦA NĂM ĐƯỢC CHỌN
//             monthly: [
//                { $match: { year: selectedYear } },
//                {
//                  $group: {
//                    _id: "$month", 
//                    revenue: { $sum: "$netPayout" },
//                    count: { $sum: 1 }
//                  }
//                },
//                { $sort: { _id: 1 } }
//             ]
//          }
//       }
//     ]);

//     const availableYears = stats[0].availableYears.map(y => y._id);
//     // Nếu chưa có năm nào, mặc định trả về năm nay
//     if (availableYears.length === 0) availableYears.push(new Date().getFullYear());

//     const totalData = stats[0].totalForYear[0] || { total: 0, count: 0 };
//     const monthlyData = stats[0].monthly || [];

//     // Format dữ liệu biểu đồ (đủ 12 tháng)
//     const chartData = Array.from({ length: 12 }, (_, i) => {
//       const month = i + 1;
//       const found = monthlyData.find(m => m._id === month);
//       return {
//         name: `T${month}`,
//         revenue: found ? Math.round(found.revenue) : 0,
//         bookings: found ? found.count : 0
//       };
//     });

//     res.json({
//       selectedYear,
//       availableYears, // Danh sách năm [2025, 2024...]
//       totalRevenue: Math.round(totalData.total), // Tổng của năm chọn
//       totalBookings: totalData.count,
//       chartData
//     });

//   } catch (e) {
//     next(e);
//   }
// };

export const getHostRevenueStats = async (req, res, next) => {
  try {
    const hostId = req.user._id;
    const { year, month } = req.query;

    const currentYear = new Date().getFullYear();
    const selectedYear = year && !isNaN(Number(year)) ? Number(year) : currentYear;
    
    let selectedMonth = null;
    if (month && month !== 'all' && !isNaN(Number(month))) {
        selectedMonth = Number(month);
    }
    let startDate, endDate;
    if (selectedMonth) {
        startDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
        endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    } else {
        startDate = new Date(selectedYear, 0, 1, 0, 0, 0);
        endDate = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    }

    const dateConfig = { date: "$checkoutDate", timezone: "Asia/Ho_Chi_Minh" };
    const groupId = selectedMonth ? { $dayOfMonth: dateConfig } : { $month: dateConfig };
    const stats = await Booking.aggregate([
      { 
        $match: {
          hostId: hostId,
          status: { $in: ['paid', 'completed', 'refunded', 'cancelled_by_guest', 'cancelled_by_host'] },
          checkoutDate: { $gte: startDate, $lte: endDate }
        } 
      },
      {
        $project: {
          netPayout: { 
             $multiply: [
               { $subtract: ["$pricing.total", { $ifNull: ["$refund.refundAmount", 0] }] },
               0.95 
             ]
          },
          checkoutDate: 1
        }
      },
      { $match: { netPayout: { $gt: 0 } } }, 
      {
         $facet: {
            summary: [
               { $group: { _id: null, total: { $sum: "$netPayout" }, count: { $sum: 1 } } }
            ],
            // Dữ liệu biểu đồ
            chart: [
               {
                 $group: {
                   _id: groupId, 
                   revenue: { $sum: "$netPayout" },
                   count: { $sum: 1 }
                 }
               },
               { $sort: { _id: 1 } }
            ]
         }
      }
    ]);
    const result = stats[0];
    const summary = result.summary[0] || { total: 0, count: 0 };
    const rawChart = result.chart || [];
    let chartData = [];

    if (selectedMonth) {
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        chartData = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const found = rawChart.find(item => item._id === day);
            return {
                name: `${day}/${selectedMonth}`,
                revenue: found ? Math.round(found.revenue) : 0,
                bookings: found ? found.count : 0
            };
        });
    } else {
        chartData = Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const found = rawChart.find(item => item._id === m);
            return {
                name: `T${m}`,
                revenue: found ? Math.round(found.revenue) : 0,
                bookings: found ? found.count : 0
            };
        });
    }

    res.json({
      selectedYear,
      selectedMonth: selectedMonth || 'all',
      totalRevenue: Math.round(summary.total),
      totalBookings: summary.count,
      chartData
    });

  } catch (e) {
    next(e);
  }
};