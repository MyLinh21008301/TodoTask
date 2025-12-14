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
  query: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
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
  resultsCount: {
    type: Number,
    default: 0
  },
  ip: String,
  userAgent: String
}, { 
  timestamps: true 
});

SearchHistorySchema.index({ userId: 1, createdAt: -1 });
SearchHistorySchema.index({ userId: 1, query: 1 });
SearchHistorySchema.index({ 'filters.citySlug': 1, createdAt: -1 });
SearchHistorySchema.index({ createdAt: -1 }); // For popular searches

// Tự động xóa search history cũ hơn 90 ngày
SearchHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const SearchHistory = mongoose.model('SearchHistory', SearchHistorySchema);
export default SearchHistory;

