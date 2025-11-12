// src/services/ai.service.js
// AI Service để gợi ý Listings phù hợp với user

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Phân tích user context và đưa ra criteria để tìm listings phù hợp
 */
export async function analyzeUserPreferences(userContext, searchHistory = []) {
  try {
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, using fallback');
      return getFallbackPreferences(userContext, searchHistory);
    }

    const recentSearches = searchHistory.slice(0, 5).map(s => ({
      query: s.query,
      city: s.filters?.city,
      priceRange: s.filters?.minPrice && s.filters?.maxPrice 
        ? `${s.filters.minPrice}-${s.filters.maxPrice}` 
        : null,
      amenities: s.filters?.amenities || []
    }));

    const prompt = `Bạn là AI assistant chuyên về du lịch và tìm kiếm chỗ ở.
Phân tích thông tin user và đưa ra criteria để tìm listings phù hợp.

User location: ${userContext.city || 'unknown'}
User recent searches: ${JSON.stringify(recentSearches)}

Trả về JSON với format:
{
  "preferredCities": ["thành phố user có thể thích"],
  "priceRange": { "min": số, "max": số },
  "preferredAmenities": ["amenities user thích"],
  "listingTypes": ["apartment", "hotel", "homestay", etc],
  "keywords": ["từ khóa để search"],
  "reasoning": "lý do tại sao gợi ý này"
}

Chỉ trả về JSON, không có text khác.`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes user preferences and returns JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      return getFallbackPreferences(userContext, searchHistory);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return getFallbackPreferences(userContext, searchHistory);
  } catch (error) {
    console.error('AI preferences analysis error:', error);
    return getFallbackPreferences(userContext, searchHistory);
  }
}

/**
 * Phân tích listings và rank chúng dựa trên user preferences
 */
export async function rankListingsForUser(listings, userContext, searchHistory = []) {
  try {
    if (!OPENAI_API_KEY || listings.length === 0) {
      return listings; // Return original order if no AI
    }

    // Tạo summary của listings (chỉ title, city, price, amenities)
    const listingsSummary = listings.slice(0, 20).map(listing => ({
      id: listing._id.toString(),
      title: listing.title,
      city: listing.address?.city,
      price: listing.basePrice?.amount,
      amenities: listing.amenities || []
    }));

    const recentSearches = searchHistory.slice(0, 3).map(s => s.query).join(', ');

    const prompt = `Bạn là AI assistant chuyên về du lịch.
Rank các listings sau theo độ phù hợp với user:

User location: ${userContext.city || 'unknown'}
User recent searches: ${recentSearches || 'none'}

Listings:
${JSON.stringify(listingsSummary, null, 2)}

Trả về JSON array với IDs được sắp xếp theo độ phù hợp (phù hợp nhất trước):
["id1", "id2", "id3", ...]

Chỉ trả về JSON array, không có text khác.`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that returns JSON arrays only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      return listings; // Return original order
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      return listings;
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const rankedIds = JSON.parse(jsonMatch[0]);
      
      // Reorder listings based on AI ranking
      const listingMap = new Map(listings.map(l => [l._id.toString(), l]));
      const ranked = rankedIds
        .map(id => listingMap.get(id))
        .filter(Boolean);
      
      // Add any listings not in AI ranking at the end
      const unranked = listings.filter(l => !rankedIds.includes(l._id.toString()));
      
      return [...ranked, ...unranked];
    }

    return listings;
  } catch (error) {
    console.error('AI ranking error:', error);
    return listings;
  }
}

/**
 * Tạo description ngắn gọn về lý do tại sao listings được gợi ý
 */
export async function generateRecommendationReason(userContext, listingsCount, criteria) {
  try {
    if (!OPENAI_API_KEY) {
      return `Dựa trên vị trí và tìm kiếm gần đây của bạn, chúng tôi tìm thấy ${listingsCount} chỗ ở phù hợp.`;
    }

    const prompt = `Tạo một câu ngắn gọn (tiếng Việt) giải thích tại sao gợi ý ${listingsCount} listings này cho user.

User location: ${userContext.city || 'unknown'}
Criteria: ${JSON.stringify(criteria)}

Chỉ trả về câu giải thích, không có JSON hay format khác.`;

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that returns short explanations in Vietnamese.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      return `Dựa trên vị trí và tìm kiếm gần đây của bạn, chúng tôi tìm thấy ${listingsCount} chỗ ở phù hợp.`;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    return content?.trim() || `Dựa trên vị trí và tìm kiếm gần đây của bạn, chúng tôi tìm thấy ${listingsCount} chỗ ở phù hợp.`;
  } catch (error) {
    console.error('AI reason generation error:', error);
    return `Dựa trên vị trí và tìm kiếm gần đây của bạn, chúng tôi tìm thấy ${listingsCount} chỗ ở phù hợp.`;
  }
}

// Fallback functions
function getFallbackPreferences(userContext, searchHistory) {
  const preferences = {
    preferredCities: [],
    priceRange: null,
    preferredAmenities: [],
    listingTypes: ['apartment', 'homestay'],
    keywords: [],
    reasoning: 'Dựa trên tìm kiếm gần đây'
  };

  // Extract from search history
  if (searchHistory.length > 0) {
    const lastSearch = searchHistory[0];
    if (lastSearch.filters?.city) {
      preferences.preferredCities = [lastSearch.filters.city];
    }
    if (lastSearch.filters?.minPrice && lastSearch.filters?.maxPrice) {
      preferences.priceRange = {
        min: lastSearch.filters.minPrice,
        max: lastSearch.filters.maxPrice
      };
    }
    if (lastSearch.filters?.amenities) {
      preferences.preferredAmenities = lastSearch.filters.amenities;
    }
  }

  // Default to user city
  if (userContext.city && !preferences.preferredCities.length) {
    preferences.preferredCities = [userContext.city];
  }

  return preferences;
}

