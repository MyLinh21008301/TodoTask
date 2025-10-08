import { z } from 'zod';

export const createListingSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  location: z.object({
    coordinates: z.tuple([z.number(), z.number()]) // [lng, lat]
  }).optional(),
  address: z.object({
    line1: z.string().optional(),
    ward: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional()
  }).optional(),
  amenities: z.array(z.string()).optional(),
  photos: z.array(z.object({
    s3Key: z.string().optional(),
    url: z.string().url().optional()
  })).optional(),
  basePrice: z.object({
    amount: z.number().min(0),
    currency: z.string().optional()
  }),
  fees: z.object({
    cleaning: z.number().min(0).optional(),
    service:  z.number().min(0).optional(),
    taxPct:   z.number().min(0).max(100).optional()
  }).optional(),
  unitsCount: z.number().int().min(1).optional(),
  cancellationPolicy: z.object({
    t3DaysRefundPct: z.number().min(0).max(100).optional(),
    t2DaysRefundPct: z.number().min(0).max(100).optional(),
    t1DayRefundPct: z.number().min(0).max(100).optional()
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
    // geo search
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