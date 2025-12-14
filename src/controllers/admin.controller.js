// src/controllers/admin.controller.js
import User from '../models/user.model.js';
import Listing from '../models/listing.model.js';
import Booking from '../models/booking.model.js';
import RefreshToken from '../models/refreshToken.model.js';
import { adminApproveHostSchema } from '../validators/host.schema.js';
import { PayoutBatch, HostSettlement } from '../models/payout.model.js';

/**
 * Lấy số liệu tổng quan cho Dashboard (Pending tasks)
 */
export async function getAdminDashboardCounts(req, res, next) {
  try {
    const [hostAppCount, listingModCount, complaintCount] = await Promise.all([
      User.countDocuments({ 'host.status': 'pending' }),
      Listing.countDocuments({ status: 'pending_review' }),
      Promise.resolve(0) // Mock complaint count
    ]);

    res.json({
      hostApplications: hostAppCount,
      listingModerations: listingModCount,
      complaints: complaintCount,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách chi tiết các User đang chờ duyệt Host
 */
export async function listHostApplications(req, res, next) {
  try {
    const users = await User.find({ 'host.status': 'pending' })
      .select('first_name last_name email phone host')
      .sort({ 'host.submittedAt': 1 });

    res.json(users);
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách chi tiết các Listing đang chờ duyệt
 */
export async function listListingsForModeration(req, res, next) {
  try {
    const status = req.query.status || 'pending_review';
    const listings = await Listing.find({ status: status })
      .select('title address basePrice status photos adminNote')
      .sort({ createdAt: 1 });

    res.json(listings);
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách Booking (Admin) - Hỗ trợ lọc, phân trang
 */
export async function adminListBookings(req, res, next) {
  try {
    let { status, limit = 50, skip = 0, month, year } = req.query;
    const query = {};

    if (status) {
      query.status = status.includes(',')
        ? { $in: status.split(',') }
        : status;
    }

    if (month || year) {
      const targetYear = year ? parseInt(year) : new Date().getFullYear();
      let startDate, endDate;

      if (month) {
        const targetMonth = parseInt(month) - 1; 
        startDate = new Date(targetYear, targetMonth, 1);
        endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
      } else {
       
        startDate = new Date(targetYear, 0, 1);
        endDate = new Date(targetYear, 11, 31, 23, 59, 59);
      }
      query.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }
    let dbQuery = Booking.find(query)
      .populate('guestId', 'first_name last_name email phone picture')
      .populate('hostId', 'first_name last_name email phone')
      .populate('listingId', 'title photos address')
      .sort({ updatedAt: -1 });

    const limitNumber = (limit === 'all') ? 0 : Number(limit);
    const skipNumber = Number(skip);

    if (limitNumber > 0) {
      dbQuery = dbQuery.skip(skipNumber).limit(limitNumber);
    }

    const [items, total] = await Promise.all([
      dbQuery,
      Booking.countDocuments(query)
    ]);

    const effectiveLimit = limitNumber === 0 ? total : limitNumber;
    const totalPages = limitNumber === 0 ? 1 : Math.ceil(total / effectiveLimit);
    const currentPage = limitNumber === 0 ? 1 : (Math.floor(skipNumber / effectiveLimit) + 1);

    res.json({
      items,
      total,
      pagination: {
        limit: effectiveLimit,
        currentPage,
        totalPages,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });

  } catch (e) {
    next(e);
  }
}

/**
 * Duyệt hoặc Từ chối yêu cầu làm Host
 */
export async function approveHostApplication(req, res, next) {
  try {
    const { userId, approve, reason } = adminApproveHostSchema.parse(req.body);
    const u = await User.findById(userId);

    if (!u?.host) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (approve) {
      u.host.status = 'approved';
      u.host.approvedAt = new Date();
      u.host.reason = undefined;

      if (!u.roles.includes('host')) {
        u.roles.push('host');
      }

      // Force logout để user nhận role mới
      await RefreshToken.updateMany(
        { user: u._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date() } }
      );

      await u.save();
      res.json({ message: 'Đã duyệt quyền Host thành công.', roles: u.roles });

    } else {
      u.host.status = 'rejected';
      u.host.rejectedAt = new Date();
      u.host.reason = reason || 'Hồ sơ không đạt yêu cầu.';

      await u.save();
      res.json({ message: 'Đã từ chối hồ sơ.', reason: u.host.reason });
    }
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách Users (Host/Guest) - Admin
 */
export async function adminListUsers(req, res, next) {
  try {
    const { role, limit = 20, skip = 0, q } = req.query;
    const query = {};

    if (role) {
      if (role === 'guest') {
        query.roles = { $nin: ['host', 'admin'] };
      } else {
        query.roles = role;
      }
    }

    if (q) {
      query.$or = [
        { email: { $regex: q, $options: 'i' } },
        { first_name: { $regex: q, $options: 'i' } },
        { last_name: { $regex: q, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      User.countDocuments(query)
    ]);

    res.json({ items, total });
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách Listings (Tất cả trạng thái) - Admin
 */
export async function adminListAllListings(req, res, next) {
  try {
    const { status, limit = 20, skip = 0, q } = req.query;
    const query = {};

    if (status) query.status = status;
    if (q) query.title = { $regex: q, $options: 'i' };

    const [items, total] = await Promise.all([
      Listing.find(query)
        .populate('hostId', 'first_name last_name email')
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      Listing.countDocuments(query)
    ]);

    res.json({ items, total });
  } catch (e) {
    next(e);
  }
}

/**
 * Khóa/Mở khóa tài khoản User
 */
export async function adminToggleUserStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { status: status },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: "User not found" });

    if (status === 'suspended') {
      await RefreshToken.updateMany({ user: id }, { $set: { revokedAt: new Date() } });
    }

    res.json({ message: "Cập nhật trạng thái thành công", user });
  } catch (e) {
    next(e);
  }
}

/**
 *  Lấy thống kê doanh thu toàn sàn cho Admin Dashboard
 * (Đã tính toán trừ đi tiền hoàn trả cho các đơn hủy)
 */
export async function getAdminRevenueStats(req, res, next) {
  try {
    const currentYear = new Date().getFullYear();

    // 1. Lấy số lượng tổng quan (User, Listing...)
    const [totalHosts, totalGuests, activeListings] = await Promise.all([
      User.countDocuments({ roles: 'host' }),
      User.countDocuments({ roles: 'guest' }), // Hoặc loại trừ host/admin
      Listing.countDocuments({ status: 'approved' })
    ]);

    // 2. AGGREGATION: Tính toán tài chính chuẩn xác
    const financialStats = await Booking.aggregate([
      {
        $match: {
          // Chỉ lấy các đơn đã hoàn thành hoặc hủy (có phát sinh tiền phạt)
          status: { $in: ['completed', 'paid', 'refunded', 'cancelled_by_guest', 'cancelled_by_host'] },
          // QUAN TRỌNG: Tính theo ngày CHECK-OUT (Khớp với Payout)
          checkoutDate: { $exists: true, $ne: null }
        }
      },
      {
        $project: {
          checkoutDate: 1,
          status: 1,
          // Tính Doanh thu Ròng = Tổng tiền khách trả - Tiền đã hoàn lại
          netRevenue: { 
            $subtract: [ 
              "$pricing.total", 
              { $ifNull: ["$refund.refundAmount", 0] } 
            ] 
          }
        }
      },
      {
        // Loại bỏ các đơn hoàn tiền 100% (Không có doanh thu)
        $match: {
          netRevenue: { $gt: 0 }
        }
      },
      {
        $facet: {
          // A. Tính tổng trọn đời (Lifetime)
          overall: [
            {
              $group: {
                _id: null,
                totalGMV: { $sum: "$netRevenue" },      // Tổng dòng tiền qua sàn (đã trừ refund)
                totalProfit: { $sum: { $multiply: ["$netRevenue", 0.05] } }, // 5% Lợi nhuận sàn
                totalBookings: { $sum: 1 }
              }
            }
          ],
          // B. Tính biểu đồ theo từng tháng trong năm nay
          monthly: [
            {
              $match: {
                $expr: { $eq: [{ $year: "$checkoutDate" }, currentYear] }
              }
            },
            {
              $group: {
                _id: { $month: "$checkoutDate" },
                gmv: { $sum: "$netRevenue" },
                revenue: { $sum: { $multiply: ["$netRevenue", 0.05] } }, // Lợi nhuận
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    const overall = financialStats[0].overall[0] || { totalGMV: 0, totalProfit: 0, totalBookings: 0 };
    const monthly = financialStats[0].monthly || [];

    // 3. Chuẩn hóa dữ liệu biểu đồ (Lấp đầy các tháng thiếu bằng 0)
    const chartData = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const found = monthly.find(m => m._id === month);
      return {
        name: `T${month}`,
        gmv: found ? Math.round(found.gmv) : 0,          // Tổng GMV
        revenue: found ? Math.round(found.revenue) : 0,  // Lợi nhuận (5%)
        bookings: found ? found.count : 0
      };
    });

    res.json({
      counts: {
        hosts: totalHosts,
        guests: totalGuests,
        listings: activeListings,
        bookings: overall.totalBookings
      },
      revenue: {
        totalGMV: Math.round(overall.totalGMV),       // Hiển thị ở Card "Tổng Doanh Thu (GMV)"
        totalProfit: Math.round(overall.totalProfit)  // Hiển thị ở Card "Lợi Nhuận Thực (Net)"
      },
      chartData // Dữ liệu vẽ biểu đồ AreaChart
    });

  } catch (e) {
    next(e);
  }
}

/**
 * Lấy thông tin đợt chi trả hiện tại (Tự động tính toán)
 */
export async function getLatestPayoutBatch(req, res, next) {
  try {
    const today = new Date();
    let targetMonth = today.getMonth(); 
    let targetYear = today.getFullYear();

    if (targetMonth === 0) {
      targetMonth = 12; 
      targetYear -= 1;
    } 

    const startOfTargetMonth = new Date(targetYear, targetMonth - 1, 1);
    const endOfTargetMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    let batch = await PayoutBatch.findOne({ month: targetMonth, year: targetYear });

    if (!batch) {
      console.log(`Admin Payout: Đang tính toán công nợ tháng ${targetMonth}/${targetYear}...`);


      const stats = await Booking.aggregate([
        {
          $match: {
            status: { $in: ['completed', 'paid', 'refunded', 'cancelled_by_guest', 'cancelled_by_host'] },
            checkoutDate: { $gte: startOfTargetMonth, $lte: endOfTargetMonth }
          }
        },
        {
          $project: {
            hostId: 1,
            pricing: 1,
            refund: 1,
            netRevenue: { 
              $subtract: [ 
                "$pricing.total", 
                { $ifNull: ["$refund.refundAmount", 0] } 
              ] 
            }
          }
        },
        {
          $match: {
            netRevenue: { $gt: 0 }
          }
        },
        {
          $group: {
            _id: "$hostId",
            totalBookings: { $sum: 1 },
            totalNetRevenue: { $sum: "$netRevenue" }
          }
        }
      ]);

      if (stats.length === 0) {
         batch = await PayoutBatch.create({
           month: targetMonth, year: targetYear, 
           fromDate: startOfTargetMonth, toDate: endOfTargetMonth,
           status: 'completed'
         });
         return res.json(formatBatchResponse(batch));
      }

      batch = new PayoutBatch({
        month: targetMonth, year: targetYear, 
        fromDate: startOfTargetMonth, toDate: endOfTargetMonth,
        status: 'processing',
        totalSettlements: stats.length
      });

      let grandTotalPayout = 0;
      let grandTotalFee = 0;
      let grandTotalGmv = 0;

      const hostIds = stats.map(s => s._id);
      const hostsInfo = await User.find({ _id: { $in: hostIds } }).select('host.payout.bank');
      const hostMap = {};
      hostsInfo.forEach(h => { hostMap[h._id.toString()] = h.host?.payout?.bank });

      const settlements = stats.map(s => {
        const netGmv = s.totalNetRevenue;
        const fee = netGmv * 0.05;  
        const payout = netGmv * 0.95; 

        grandTotalGmv += netGmv;
        grandTotalFee += fee;
        grandTotalPayout += payout;

        const bankInfo = hostMap[s._id.toString()] || {};

        return {
          batchId: batch._id,
          hostId: s._id,
          bankSnapshot: {
            bankName: bankInfo.bankName || 'Chưa cập nhật',
            accountHolder: bankInfo.accountHolder || 'Chưa cập nhật',
            accountNumber: bankInfo.accountNumberMasked || 'Chưa cập nhật' 
          },
          totalBookings: s.totalBookings,
          totalNetRevenue: netGmv,
          platformFee: fee,
          payoutAmount: payout,
          status: 'pending'
        };
      });
      batch.totalGmv = grandTotalGmv;
      batch.totalPlatformFee = grandTotalFee;
      batch.totalPayout = grandTotalPayout;
      
      await Promise.all([
        batch.save(),
        HostSettlement.insertMany(settlements)
      ]);
    }
    res.json(formatBatchResponse(batch));

  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách chi tiết Host cần trả tiền
 */
export async function listHostSettlements(req, res, next) {
  try {
    const { batchId } = req.query;
    let query = {};
    if (!batchId) {
      const latest = await PayoutBatch.findOne().sort({ createdAt: -1 });
      if (!latest) return res.json([]);
      query.batchId = latest._id;
    } else {
      query.batchId = batchId;
    }

    const rows = await HostSettlement.find(query)
      .populate('hostId', 'first_name last_name email phone') 
      .sort({ payoutAmount: -1 }); 
    const response = rows.map(item => ({
      id: item._id,
      hostName: item.hostId ? `${item.hostId.first_name} ${item.hostId.last_name}` : 'Unknown Host',
      email: item.hostId?.email,
      
      bankName: item.bankSnapshot?.bankName,
      bankAccount: item.bankSnapshot?.accountNumber,
      bankHolder: item.bankSnapshot?.accountHolder,

      totalBookings: item.totalBookings,
      totalGmv: item.totalNetRevenue, 
      platformFee: item.platformFee,
      payoutAmount: item.payoutAmount,
      status: item.status
    }));

    res.json(response);
  } catch (e) {
    next(e);
  }
}

/**
 * Admin xác nhận đã chuyển khoản 
 */
export async function confirmSettlementPayment(req, res, next) {
  try {
    const { id } = req.params; 

    const settlement = await HostSettlement.findById(id);
    if (!settlement) return res.status(404).json({ message: 'Không tìm thấy khoản thanh toán' });
    
    if (settlement.status === 'paid') {
      return res.status(400).json({ message: 'Khoản này đã được thanh toán rồi' });
    }

    // Update trạng thái
    settlement.status = 'paid';
    settlement.paidAt = new Date();
    await settlement.save();

    // Cập nhật tiến độ Batch cha
    const batch = await PayoutBatch.findById(settlement.batchId);
    if (batch) {
      batch.paidCount += 1;
      // Nếu đã trả hết tất cả -> Đánh dấu Batch hoàn thành
      if (batch.paidCount >= batch.totalSettlements) {
        batch.status = 'completed';
      }
      await batch.save();
    }

    res.json({ message: 'Xác nhận thanh toán thành công', settlement });
  } catch (e) {
    next(e);
  }
}

// Helper format dữ liệu Batch trả về
function formatBatchResponse(batch) {
  const progress = batch.totalSettlements === 0 ? 100 : Math.round((batch.paidCount / batch.totalSettlements) * 100);
  return {
    id: batch._id,
    fromDate: batch.fromDate.toLocaleDateString('vi-VN'),
    toDate: batch.toDate.toLocaleDateString('vi-VN'),
    feePercent: 5,
    totalPlatformFee: batch.totalPlatformFee,
    totalPayoutAmount: batch.totalPayout,
    progressPercent: progress,
    status: batch.status
  };
}