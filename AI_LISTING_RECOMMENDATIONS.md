# AI-Powered Listing Recommendations

## Tổng quan

Hệ thống sử dụng AI để gợi ý **Listings** (chỗ ở) phù hợp với user dựa trên:
- **User location** (vị trí hiện tại)
- **Recent searches** (tìm kiếm gần đây)
- **User preferences** (sở thích được AI phân tích)
- **Listing features** (amenities, price, location)

## Cấu hình

### 1. Thêm OpenAI API Key vào `.env`

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 2. Lấy OpenAI API Key

1. Đăng ký tại [OpenAI Platform](https://platform.openai.com/)
2. Tạo API key tại [API Keys](https://platform.openai.com/api-keys)
3. Copy key vào file `.env`

## API Endpoint

### GET /api/search/recommendations

Lấy danh sách listings được AI gợi ý.

**Query Parameters:**
- `limit` (optional): Số lượng listings (default: 10)
- `city` (optional): City filter
- `lat`, `lng` (optional): Location coordinates để geo search

**Response:**
```json
{
  "items": [
    {
      "_id": "...",
      "title": "Apartment giá rẻ ở HCM",
      "address": { "city": "Ho Chi Minh" },
      "basePrice": { "amount": 1000000 },
      "amenities": ["wifi", "parking"],
      ...
    }
  ],
  "total": 10,
  "reason": "Dựa trên vị trí Hồ Chí Minh và tìm kiếm gần đây về apartment giá rẻ, chúng tôi gợi ý những chỗ ở này cho bạn.",
  "criteria": {
    "preferredCities": ["Ho Chi Minh"],
    "priceRange": { "min": 800000, "max": 2000000 },
    "preferredAmenities": ["wifi"],
    "listingTypes": ["apartment"],
    "reasoning": "User đã tìm kiếm apartment giá rẻ ở HCM"
  }
}
```

**Ví dụ:**
```bash
# Lấy recommendations (không cần auth, nhưng tốt hơn nếu có)
GET /api/search/recommendations?limit=10

# Với location
GET /api/search/recommendations?limit=10&lat=10.8231&lng=106.6297

# Với city filter
GET /api/search/recommendations?limit=10&city=Ho Chi Minh
```

## Cách AI hoạt động

### 1. Phân tích User Preferences

AI phân tích:
- User location (từ profile hoặc query param)
- Recent searches (từ search history)
- Search patterns (loại chỗ ở, price range, amenities)

Và đưa ra criteria:
- Preferred cities
- Price range
- Preferred amenities
- Listing types

### 2. Tìm Listings

Dựa trên criteria từ AI, hệ thống tìm listings phù hợp:
- Filter theo city
- Filter theo price range
- Filter theo amenities
- Geo search nếu có coordinates

### 3. AI Ranking

AI rank listings theo độ phù hợp:
- So sánh listings với user preferences
- Xem xét recent searches
- Đưa ra thứ tự phù hợp nhất

### 4. Generate Reason

AI tạo câu giải thích tại sao gợi ý những listings này.

## Tính năng

### ✅ AI-Powered Recommendations
- Phân tích user preferences
- Tìm listings phù hợp
- Rank theo độ phù hợp

### ✅ Location-Based
- Dựa trên user location
- Geo search nếu có coordinates
- Gợi ý thành phố phù hợp

### ✅ Personalized
- Học từ search history
- Hiểu user preferences
- Đưa ra gợi ý cá nhân hóa

### ✅ Fallback Support
- Nếu không có AI key, vẫn hoạt động
- Rule-based recommendations
- Không ảnh hưởng functionality

## Testing

### Test với Postman:

1. **Get AI recommendations (không auth):**
```bash
GET http://localhost:5001/api/search/recommendations?limit=10
```

2. **Get AI recommendations với location:**
```bash
GET http://localhost:5001/api/search/recommendations?limit=10&lat=10.8231&lng=106.6297
```

3. **Get AI recommendations (với auth để có search history):**
```bash
GET http://localhost:5001/api/search/recommendations?limit=10
Authorization: Bearer <token>
```

## Cost Optimization

### Tips:
1. **Cache results**: Cache recommendations trong Redis (có thể implement sau)
2. **Limit AI calls**: Chỉ gọi AI khi cần (có user context hoặc search history)
3. **Batch processing**: Có thể batch nhiều users cùng lúc
4. **Use GPT-3.5-turbo**: Rẻ hơn GPT-4, đủ tốt

### Estimated Cost:
- GPT-3.5-turbo: ~$0.002 per 1K tokens
- Mỗi recommendation call: ~800-1500 tokens
- Cost per 1000 requests: ~$1.6-3

## Troubleshooting

### Lỗi: "OpenAI API key not configured"
- Kiểm tra file `.env` có `OPENAI_API_KEY`
- Restart server sau khi thêm key

### AI không hoạt động
- Hệ thống tự động fallback về rule-based
- Vẫn trả về listings, chỉ không có AI ranking
- Kiểm tra console logs để debug

### Recommendations không phù hợp
- Kiểm tra user có search history không
- Kiểm tra user location có đúng không
- Có thể cần fine-tune AI prompts

## Next Steps

Có thể cải thiện:
1. **Vector embeddings**: Dùng embeddings để tìm listings tương tự
2. **Collaborative filtering**: Dựa trên users tương tự
3. **A/B testing**: Test các AI prompts khác nhau
4. **Redis caching**: Cache recommendations để giảm cost
5. **Real-time updates**: Update recommendations khi user search mới

