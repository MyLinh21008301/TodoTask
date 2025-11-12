// src/models/searchHistory.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

const SearchHistorySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Cho phép null cho guest users
    index: true
  },
  // Search query
  query: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  // Search filters
  filters: {
    city: String,
    citySlug: String,
    minPrice: Number,
    maxPrice: Number,
    amenities: [String],
    // Geo location
    lat: Number,
    lng: Number,
    radius: Number
  },
  // Search results count
  resultsCount: {
    type: Number,
    default: 0
  },
  // IP address để detect location nếu user chưa đăng nhập
  ip: String,
  // User agent
  userAgent: String
}, { 
  timestamps: true 
});

// Index để query nhanh
SearchHistorySchema.index({ userId: 1, createdAt: -1 });
SearchHistorySchema.index({ userId: 1, query: 1 });
SearchHistorySchema.index({ 'filters.citySlug': 1, createdAt: -1 });
SearchHistorySchema.index({ createdAt: -1 }); // For popular searches

// Tự động xóa search history cũ hơn 90 ngày
SearchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const SearchHistory = mongoose.model('SearchHistory', SearchHistorySchema);
export default SearchHistory;

