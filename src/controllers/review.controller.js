// src/controllers/review.controller.js
import Listing from '../models/listing.model.js';
import Booking from '../models/booking.model.js';

export const createReview = async (req, res, next) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const userId = req.user._id;

    // 1. Tìm Booking của user
    const booking = await Booking.findOne({ _id: bookingId, guestId: userId });
    if (!booking) return res.status(404).json({ message: 'Không tìm thấy đơn đặt phòng.' });

    // 2. Kiểm tra điều kiện
    if (booking.isReviewed) {
      return res.status(400).json({ message: 'Bạn đã đánh giá chuyến đi này rồi.' });
    }
    if (booking.status !== 'paid' && booking.status !== 'completed') {
      return res.status(400).json({ message: 'Đơn hàng chưa hoàn tất thanh toán.' });
    }
    
    // Kiểm tra ngày hiện tại phải SAU ngày checkout
    const now = new Date();
    const checkout = new Date(booking.checkoutDate);
    if (now < checkout) {
        return res.status(400).json({ message: 'Bạn chỉ có thể đánh giá sau khi đã trả phòng.' });
    }

    // 3. Tìm Listing
    const listing = await Listing.findById(booking.listingId);
    if (!listing) return res.status(404).json({ message: 'Listing không tồn tại.' });

    // 4. Tạo Review Object
    const newReview = {
      bookingId: booking._id,
      guestId: userId,
      rating: Number(rating),
      comment: comment || '',
      createdAt: new Date()
    };

    // 5. Nhúng review vào mảng reviews của Listing
    listing.reviews.push(newReview);
    
    // 6. Tính toán lại điểm trung bình
    listing.reviewCount = listing.reviews.length;
    const totalRating = listing.reviews.reduce((sum, item) => sum + item.rating, 0);
    listing.averageRating = (totalRating / listing.reviewCount); // Lưu dạng số thực

    await listing.save();

    // 7. Đánh dấu booking đã review
    booking.isReviewed = true;
    // Tùy chọn: Chuyển trạng thái sang completed
    if (booking.status === 'paid') booking.status = 'completed';
    
    await booking.save();

    res.status(201).json({ message: 'Đánh giá thành công!', review: newReview });
  } catch (e) {
    next(e);
  }
};