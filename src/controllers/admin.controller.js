// src/controllers/admin.controller.js
import User from '../models/user.model.js';
import Listing from '../models/listing.model.js';
// (Import Complaint model nếu có)

/**
 * [MỚI] Lấy số đếm cho các mục chờ duyệt trên Dashboard
 */
export async function getAdminDashboardCounts(req, res, next) {
  try {
    const [hostAppCount, listingModCount, complaintCount] = await Promise.all([
      // 1. Đếm số user đang chờ duyệt host
      User.countDocuments({ 'host.status': 'pending' }),
      
      // 2. Đếm số listing đang chờ duyệt
      Listing.countDocuments({ status: 'pending_review' }),
      
      // 3. Đếm khiếu nại (Tạm thời = 0, vì chưa có model)
      Promise.resolve(0) 
    ]);

    res.json({
      hostApplications: hostAppCount,
      listingModerations: listingModCount,
      complaints: complaintCount,
      // Thêm các mục khác nếu cần
    });
  } catch (e) {
    next(e);
  }
}


/**
 * [MỚI] Lấy danh sách chi tiết các User đang chờ duyệt Host
 */
export async function listHostApplications(req, res, next) {
  try {
    const users = await User.find({ 'host.status': 'pending' })
      .select('first_name last_name email phone host') // Chỉ lấy các trường cần thiết
      .sort({ 'host.submittedAt': 1 }); // Cũ nhất lên đầu

    res.json(users);
  } catch (e) {
    next(e);
  }
}


/**
 * [MỚI] Lấy danh sách chi tiết các Listing đang chờ duyệt
 */
export async function listListingsForModeration(req, res, next) {
   try {
    // Lấy status từ query, mặc định là 'pending_review'
    const status = req.query.status || 'pending_review';

    const listings = await Listing.find({ status: status })
      .select('title address basePrice status photos adminNote') // Lấy các trường cần
      .sort({ createdAt: 1 }); // Cũ nhất lên đầu

    res.json(listings);
  } catch (e) {
    next(e);
  }
}