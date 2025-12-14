// src/validators/listing.schema.js
import { z } from 'zod';
export const createListingSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(20, 'Mô tả phải có ít nhất 20 ký tự'),
  location: z.object({
    coordinates: z.tuple([z.number(), z.number()]) 
  }).optional(),
  address: z.object({
    city: z.string().min(1, "Vui lòng chọn Tỉnh/Thành phố"),
    district: z.string().min(1, "Vui lòng chọn Quận/Huyện"),
    ward: z.string().min(1, "Vui lòng chọn Phường/Xã"),
    line1: z.string().min(5, 'Vui lòng nhập địa chỉ chi tiết (số nhà, đường)'),
  }),
  amenities: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất 1 tiện nghi'),
  photos: z.array(z.object({
    s3Key: z.string(),
    url: z.string().url().optional() // url có thể không cần gửi từ client
  })).min(3, 'Vui lòng tải lên ít nhất 3 tấm ảnh'),
  basePrice: z.object({
    amount: z.number({ invalid_type_error: 'Vui lòng nhập giá' }).min(1000, 'Giá phải ít nhất 1,000 VNĐ'),
    currency: z.string().optional().default('VND'),
  }),
  fees: z.object({
    cleaning: z.number().min(0).optional(),
    service:  z.number().min(0).optional(),
    taxPct:   z.number().min(0).max(100).optional()
  }).optional(),

  roomDetails: z.object({
    bedrooms: z.number().int().min(1, 'Phải có ít nhất 1 phòng ngủ').optional(), // <<< Sửa thành min(1)
    livingRooms: z.number().int().min(0).optional(),
    bathrooms: z.number().int().min(0).optional()
  }).optional(),

  unitsCount: z.number().int().min(1).optional(),
  cancellationPolicy: z.object({
    t3DaysRefundPct: z.number().min(0).max(100).default(90),
    t2DaysRefundPct: z.number().min(0).max(100).default(50),
    t1DayRefundPct: z.number().min(0).max(100).default(30)
  }).optional()
});
export const updateListingSchema = createListingSchema.partial();
export const adminModerateSchema = z.object({
  approve: z.boolean(),
  note: z.string().optional()
});

export const mineQuerySchema = z.object({
    status: z.enum(['draft','pending_review','approved','rejected','archived']).optional(),
    limit: z.string().optional(),
    skip: z.string().optional()
  });
  
  export const publicSearchSchema = z.object({
    city: z.string().optional(),
    q: z.string().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    amenities: z.string().optional(), 
    hostId: z.string().optional(),
    lng: z.string().optional(),
    lat: z.string().optional(),
    radius: z.string().optional(), 
    limit: z.string().optional(),
    skip: z.string().optional(),
    sort: z.enum(['newest','price_asc','price_desc']).optional()
  });
  
  export const reorderPhotosSchema = z.object({
    order: z.array(z.number().int().min(0))
  });
  
  export const removePhotoSchema = z.object({
    index: z.number().int().min(0)
  });