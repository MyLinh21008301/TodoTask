// src/controllers/promotion.controller.js
import Promotion from '../models/promotion.model.js';
import { createPromotionSchema } from '../validators/promotion.schema.js';

export const createPromotion = async (req, res, next) => {
  try {
    const body = createPromotionSchema.parse(req.body);
    const hostId = req.user._id;
    const listingId = body.listingId ? body.listingId : null;

    // Kiểm tra tồn tại
    const exist = await Promotion.findOne({ code: body.code });
    if (exist) {
        return res.status(400).json({ message: `Mã ${body.code} đã được sử dụng.` });
    }
    const listingIds = body.listingIds || [];

    const promo = await Promotion.create({ ...body, hostId, listingIds });
    res.status(201).json(promo);
  } catch (e) { next(e); }
};

export const getMyPromotions = async (req, res, next) => {
    try {
      const hostId = req.user._id;
      const promos = await Promotion.find({ hostId })
          .populate('listingIds', 'title') 
          .sort({ createdAt: -1 });
      res.json({ items: promos });
    } catch (e) { next(e); }
  };

export const getPromotionById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const hostId = req.user._id;

        const promo = await Promotion.findOne({ _id: id, hostId })
            .populate('listingIds', 'title address photos basePrice averageRating reviewCount'); 

        if (!promo) {
            return res.status(404).json({ message: 'Khuyến mãi không tồn tại hoặc bạn không có quyền truy cập.' });
        }

        res.json(promo);
    } catch (e) {
        next(e);
    }
};
export const deletePromotion = async (req, res, next) => {
    try {
        const { id } = req.params;
        const hostId = req.user._id;
        const promo = await Promotion.findOneAndDelete({ _id: id, hostId });
        if(!promo) return res.status(404).json({message: 'Not found'});
        res.json({ message: 'Deleted successfully' });
    } catch (e) { next(e); }
}
  
export const checkPromotionCode = async (req, res, next) => {
    try {
        const { code, listingId, totalAmount, nights } = req.body; 

        if(!code) return res.status(400).json({ message: 'Vui lòng nhập mã' });

        const promo = await Promotion.findOne({ code: code.toUpperCase(), isActive: true });
        
        if (!promo) return res.status(404).json({ valid: false, message: 'Mã khuyến mãi không tồn tại' });
        const now = new Date();
        if (now < new Date(promo.dateFrom) || now > new Date(promo.dateTo)) {
            return res.status(400).json({ valid: false, message: 'Mã khuyến mãi đã hết hạn hoặc chưa bắt đầu' });
        }

        if (promo.listingIds && promo.listingIds.length > 0) {
            const isApplicable = promo.listingIds.some(id => id.toString() === listingId);
            if (!isApplicable) {
                return res.status(400).json({ valid: false, message: 'Mã không áp dụng cho phòng này' });
            }
        }
        if (promo.minNights > 0 && nights < promo.minNights) {
            return res.status(400).json({ valid: false, message: `Mã yêu cầu đặt tối thiểu ${promo.minNights} đêm` });
        }
        let discountAmount = 0;
        if (promo.type === 'percent') {
            discountAmount = (totalAmount * promo.value) / 100;
        } else {
            discountAmount = promo.value;
        }
        if (discountAmount > totalAmount) discountAmount = totalAmount;

        res.json({
            valid: true,
            message: 'Áp dụng mã thành công!',
            discountAmount: Math.round(discountAmount),
            promoCode: promo.code
        });

    } catch (e) {
        next(e);
    }
}
export const getPromotionsForListing = async (req, res, next) => {
    try {
      const { listingId } = req.params;
      const now = new Date();
      const ListingModel = (await import('../models/listing.model.js')).default;
      const listing = await ListingModel.findById(listingId);
      
      if (!listing) return res.json({ items: [] }); 
  
      const query = {
        hostId: listing.hostId,      
        isActive: true,
        dateTo: { $gte: now },       
        $or: [
          { listingIds: { $size: 0 } },          
          { listingIds: { $in: [listingId] } },  
          { listingId: null },                    
          { listingId: listingId }              
        ]
      };
  
      const promos = await Promotion.find(query)
          .select('code title value type minNights dateFrom dateTo listingIds listingId'); 
      
      res.json({ items: promos });
    } catch (e) {
      next(e);
    }
  };