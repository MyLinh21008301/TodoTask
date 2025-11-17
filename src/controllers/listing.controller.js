// src/listing.controller.js
import Listing from '../models/listing.model.js';
import { createListingSchema, updateListingSchema, adminModerateSchema, publicSearchSchema, mineQuerySchema,
    reorderPhotosSchema, removePhotoSchema } from '../validators/listing.schema.js';
import { toSlug } from '../utils/text.js'; // <-- Sẽ import hàm toSlug đã sửa
import mongoose from 'mongoose';


// Host tạo listing (auto pending_review)
export async function createListing(req, res, next) {
    try {
      const body = createListingSchema.parse(req.body);
      const city = body.address?.city; // Ví dụ: "Thành phố Hà Nội"
            
      const doc = await Listing.create({
        ...body,
        hostId: req.user._id,
        // toSlug("Thành phố Hà Nội") sẽ trả về "ha-noi"
        citySlug: city ? toSlug(city) : undefined, 
        status: 'pending_review',
        adminApproval: { status: 'pending_review' }
      });
      res.status(201).json(doc);
    } catch (e) { next(e); }
  }

// Host sửa listing của mình -> về pending_review
export async function updateListing(req, res, next) {
    try {
      const id = req.params.id;
      const body = updateListingSchema.parse(req.body);
  
      const doc = await Listing.findOne({ _id: id, hostId: req.user._id });
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
  
      Object.assign(doc, body);
  
      if (body.address?.city) {
        // toSlug("Thành phố Hà Nội") sẽ trả về "ha-noi"
        doc.citySlug = toSlug(body.address.city);  
      }
  
      // mỗi lần sửa phải duyệt lại
      doc.status = 'pending_review';
      doc.adminApproval = { status: 'pending_review' };
  
      await doc.save();
      res.json(doc);
    } catch (e) { next(e); }
  }
  

// Admin duyệt / từ chối listing
export async function adminModerateListing(req, res, next) {
    try {
      const id = req.params.id;
      const { approve, note } = adminModerateSchema.parse(req.body);
  
      const doc = await Listing.findById(id);
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
  
      if (approve) {
        doc.status = 'approved';
        doc.adminApproval = {
          status: 'approved',
          approvedBy: req.user._id,
          approvedAt: new Date(),
          note
        };
      } else {
        doc.status = 'rejected';
        doc.adminApproval = {
          status: 'rejected',
          approvedBy: req.user._id,
          approvedAt: new Date(),
          note: note || 'Rejected by admin'
        };
      }
  
      await doc.save();
      res.json(doc);
    } catch (e) { next(e); }
  }


  export async function getApprovedListing(req, res, next) {
    try {
      const id = req.params.id;
  
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(404).json({ message: 'Listing not found' });
      }
  
      if (req.user) {
        const me = req.user;
        const doc = await Listing.findById(id);
        if (!doc) return res.status(404).json({ message: 'Listing not found' });
        const isOwner = String(doc.hostId) === String(me._id);
        const isAdmin = me.roles?.includes('admin');
        if (isOwner || isAdmin) return res.json(doc);
      }
  
      const doc = await Listing.findOne({ _id: id, status: 'approved' });
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
      res.json(doc);
    } catch (e) { next(e); }
  }
  
  /** PUBLIC: search approved + filter cơ bản + geo */
  export async function searchApproved(req, res, next) {
    try {
      const q = publicSearchSchema.parse(req.query);
      const cond = { status: 'approved' };
  
      if (q.city) {
        // q.city từ frontend gửi lên là "ha-noi" (đã có gạch nối)
        // Hàm toSlug mới sẽ không thay đổi gì "ha-noi"
        cond.citySlug = toSlug(q.city);
      }
      if (q.q) cond.title = { $regex: q.q, $options: 'i' };
  
      if (q.minPrice || q.maxPrice) {
        cond['basePrice.amount'] = {};
        if (q.minPrice) cond['basePrice.amount'].$gte = Number(q.minPrice);
        if (q.maxPrice) cond['basePrice.amount'].$lte = Number(q.maxPrice);
      }
  
      if (q.amenities) {
        const arr = q.amenities.split(',').map(s => s.trim()).filter(Boolean);
        if (arr.length) cond.amenities = { $all: arr };
      }
  
      if (q.lng && q.lat && q.radius) {
        cond.location = {
          $near: {
            $geometry: { type: 'Point', coordinates: [Number(q.lng), Number(q.lat)] },
          $maxDistance: Number(q.radius)
          }
        };
      }
  
      const limit = Number(q.limit ?? 20);
      const skip  = Number(q.skip ?? 0);
      const sortMap = {
        newest: { createdAt: -1 },
        price_asc: { 'basePrice.amount': 1 },
        price_desc: { 'basePrice.amount': -1 }
      };
      const sort = sortMap[q.sort ?? 'newest'];
  
      const items = await Listing.find(cond).limit(limit).skip(skip).sort(sort);
      const total = await Listing.countDocuments(cond);
      res.json({ items, total, limit, skip });
    } catch (e) { next(e); }
  }
  
  
  /** HOST: list my listings (lọc trạng thái, phân trang) */
  export async function listMine(req, res, next) {
    try {
      const q = mineQuerySchema.parse(req.query);
      const cond = { hostId: req.user._id };
      if (q.status) cond.status = q.status;
      const limit = Number(q.limit ?? 20);
      const skip = Number(q.skip ?? 0);
      const items = await Listing.find(cond).limit(limit).skip(skip).sort({ updatedAt: -1 });
      const total = await Listing.countDocuments(cond);
      res.json({ items, total, limit, skip });
    } catch (e) { next(e); }
  }
  
  /** HOST: submit for review (từ draft/rejected -> pending_review) */
  export async function submitForReview(req, res, next) {
    try {
      const id = req.params.id;
      const doc = await Listing.findOne({ _id: id, hostId: req.user._id });
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
  
      doc.status = 'pending_review';
      doc.adminApproval = { status: 'pending_review' };
      await doc.save();
      res.json({ message: 'Submitted for review', status: doc.status });
    } catch (e) { next(e); }
  }
  
  /** HOST: archive & unarchive */
  export async function archiveListing(req, res, next) {
    try {
      const id = req.params.id;
      const doc = await Listing.findOne({ _id: id, hostId: req.user._id });
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
  
      doc.status = 'archived';
      await doc.save();
      res.json({ message: 'Archived' });
    } catch (e) { next(e); }
  }
  
  export async function unarchiveListing(req, res, next) {
    try {
      const id = req.params.id;
      const doc = await Listing.findOne({ _id: id, hostId: req.user._id });
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
  
      // bỏ lưu trữ quay lại pending_review để admin kiểm duyệt lại
      doc.status = 'pending_review';
      doc.adminApproval = { status: 'pending_review' };
      await doc.save();
      res.json({ message: 'Unarchived -> pending_review' });
    } catch (e) { next(e); }
  }
  
  /** HOST: reorder photos */
  export async function reorderPhotos(req, res, next) {
    try {
      const { order } = reorderPhotosSchema.parse(req.body);
      const id = req.params.id;
      const doc = await Listing.findOne({ _id: id, hostId: req.user._id });
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
  
      if (!Array.isArray(doc.photos)) doc.photos = [];
      if (order.some(i => i < 0 || i >= doc.photos.length)) {
        return res.status(400).json({ message: 'Invalid order index' });
      }
      doc.photos = order.map(i => doc.photos[i]);
      // thay đổi media => duyệt lại
      doc.status = 'pending_review';
      doc.adminApproval = { status: 'pending_review' };
      await doc.save();
  
      res.json({ message: 'Reordered', photos: doc.photos });
    } catch (e) { next(e); }
  }
  
  /** HOST: remove one photo by index */
  export async function removePhoto(req, res, next) {
    try {
      const { index } = removePhotoSchema.parse(req.body);
      const id = req.params.id;
      const doc = await Listing.findOne({ _id: id, hostId: req.user._id });
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
  
      if (!doc.photos?.length || index >= doc.photos.length)
        return res.status(400).json({ message: 'Invalid index' });
  
      doc.photos.splice(index, 1);
      doc.status = 'pending_review';
      doc.adminApproval = { status: 'pending_review' };
      await doc.save();
  
      res.json({ message: 'Photo removed', photos: doc.photos });
    } catch (e) { next(e); }
  }
  
  /** ADMIN: liệt kê listing theo trạng thái (mặc định pending_review) */
  export async function adminList(req, res, next) {
    try {
      const status = req.query.status ?? 'pending_review';
      const limit = Number(req.query.limit ?? 20);
      const skip = Number(req.query.skip ?? 0);
      const cond = { status };
      const items = await Listing.find(cond).limit(limit).skip(skip).sort({ updatedAt: 1 });
      const total = await Listing.countDocuments(cond);
      res.json({ items, total, limit, skip });
    } catch (e) { next(e); }
  }
  
  /** ADMIN: xem chi tiết một listing (mọi trạng thái) */
  export async function adminGetOne(req, res, next) {
    try {
      const doc = await Listing.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
      res.json(doc);
    } catch (e) { next(e); }
  }