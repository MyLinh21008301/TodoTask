// src/controllers/search.controller.js
import SearchHistory from '../models/searchHistory.model.js';
import Listing from '../models/listing.model.js';
import User from '../models/user.model.js';
import { analyzeUserPreferences, rankListingsForUser, generateRecommendationReason } from '../services/ai.service.js';
import { toSlug } from '../utils/text.js';
import { z } from 'zod';

const getRecommendedListingsSchema = z.object({
  limit: z.string().optional(),
  city: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional()
});

/**
 * Lấy danh sách listings được AI gợi ý dựa trên:
 * - User location
 * - Recent searches
 * - User preferences
 */
export const getRecommendedListings = async (req, res, next) => {
  try {
    const query = getRecommendedListingsSchema.parse(req.query);
    const limit = Number(query.limit || 10);
    const userId = req.user?._id;
    
    // Lấy user context
    const user = userId ? await User.findById(userId).select('address') : null;
    const userCity = user?.address?.city || query.city;
    const userCitySlug = userCity ? toSlug(userCity) : null;

    // Lấy search history của user
    let searchHistory = [];
    if (userId) {
      searchHistory = await SearchHistory.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    const userContext = {
      city: userCity,
      citySlug: userCitySlug,
      lat: query.lat ? Number(query.lat) : null,
      lng: query.lng ? Number(query.lng) : null
    };

    // AI phân tích user preferences
    let aiPreferences = null;
    try {
      aiPreferences = await analyzeUserPreferences(userContext, searchHistory);
    } catch (err) {
      console.error('AI preferences analysis error:', err);
    }

    // Build search criteria từ AI preferences
    const searchCriteria = {
      status: 'approved'
    };

    // City filter
    if (aiPreferences?.preferredCities?.length > 0) {
      const citySlugs = aiPreferences.preferredCities.map(city => toSlug(city));
      searchCriteria.citySlug = { $in: citySlugs };
    } else if (userCitySlug) {
      searchCriteria.citySlug = userCitySlug;
    }

    // Price range filter
    if (aiPreferences?.priceRange) {
      searchCriteria['basePrice.amount'] = {};
      if (aiPreferences.priceRange.min) {
        searchCriteria['basePrice.amount'].$gte = aiPreferences.priceRange.min;
      }
      if (aiPreferences.priceRange.max) {
        searchCriteria['basePrice.amount'].$lte = aiPreferences.priceRange.max;
      }
    }

    // Amenities filter
    if (aiPreferences?.preferredAmenities?.length > 0) {
      searchCriteria.amenities = { $in: aiPreferences.preferredAmenities };
    }

    // Geo search nếu có coordinates
    if (query.lat && query.lng) {
      searchCriteria.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [Number(query.lng), Number(query.lat)]
          },
          $maxDistance: 50000 // 50km
        }
      };
    }

    // Tìm listings
    let listings = await Listing.find(searchCriteria)
      .limit(limit * 2) // Lấy nhiều hơn để AI rank
      .lean();

    // AI rank listings theo độ phù hợp
    if (listings.length > 0) {
      try {
        listings = await rankListingsForUser(listings, userContext, searchHistory);
      } catch (err) {
        console.error('AI ranking error:', err);
        // Fallback: sort by createdAt
        listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    }

    // Limit kết quả
    listings = listings.slice(0, limit);

    // Generate recommendation reason
    let reason = null;
    try {
      reason = await generateRecommendationReason(
        userContext,
        listings.length,
        aiPreferences || {}
      );
    } catch (err) {
      console.error('AI reason generation error:', err);
    }

    res.json({
      items: listings,
      total: listings.length,
      reason: reason || `Dựa trên vị trí và tìm kiếm gần đây, chúng tôi tìm thấy ${listings.length} chỗ ở phù hợp.`,
      criteria: aiPreferences || null
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ 
        message: 'Validation error', 
        errors: err.errors 
      });
    }
    console.error("Error getting recommended listings:", err);
    next(err);
  }
};

/**
 * Lưu search history (đơn giản, không cần AI analysis)
 */
export const saveSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { query, filters, resultsCount } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Query is required' });
    }

    if (query.trim().length < 2) {
      return res.json({ message: 'Query too short, not saved' });
    }

    const searchHistory = await SearchHistory.create({
      userId: userId || null,
      query: query.trim(),
      filters: filters || {},
      resultsCount: resultsCount || 0,
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json({ 
      message: 'Search history saved',
      id: searchHistory._id
    });
  } catch (err) {
    console.error("Error saving search history:", err);
    next(err);
  }
};

/**
 * Xóa search history của user
 */
export const deleteSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { query } = req.query;

    if (query) {
      await SearchHistory.deleteMany({ userId, query });
      res.json({ message: 'Search history deleted' });
    } else {
      await SearchHistory.deleteMany({ userId });
      res.json({ message: 'All search history deleted' });
    }
  } catch (err) {
    console.error("Error deleting search history:", err);
    next(err);
  }
};

/**
 * Lấy search history của user
 */
export const getUserSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const limit = Number(req.query.limit || 20);

    const history = await SearchHistory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('query filters createdAt resultsCount')
      .lean();

    res.json({ items: history, total: history.length });
  } catch (err) {
    console.error("Error getting user search history:", err);
    next(err);
  }
};

