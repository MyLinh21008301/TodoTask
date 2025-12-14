// src/listing.controller.js
import Listing from '../models/listing.model.js';
import { createListingSchema, updateListingSchema, adminModerateSchema, publicSearchSchema, mineQuerySchema,
    reorderPhotosSchema, removePhotoSchema } from '../validators/listing.schema.js';
import { toSlug } from '../utils/text.js'; 
import mongoose from 'mongoose';

export async function createListing(req, res, next) {
    try {
      const body = createListingSchema.parse(req.body);
      const city = body.address?.city; 
            
      const doc = await Listing.create({
        ...body,
        hostId: req.user._id,
        citySlug: city ? toSlug(city) : undefined, 
        status: 'pending_review',
        adminApproval: { status: 'pending_review' }
      });
      res.status(201).json(doc);
    } catch (e) { next(e); }
  }
export async function updateListing(req, res, next) {
    try {
      const id = req.params.id;
      const body = updateListingSchema.parse(req.body);
  
      const doc = await Listing.findOne({ _id: id, hostId: req.user._id });
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
  
      Object.assign(doc, body);
  
      if (body.address?.city) {
        doc.citySlug = toSlug(body.address.city);  
      }
  
      doc.status = 'pending_review';
      doc.adminApproval = { status: 'pending_review' };
  
      await doc.save();
      res.json(doc);
    } catch (e) { next(e); }
  }
  
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
  
      let query = Listing.findOne({ _id: id });
      if (req.user) {
      } else {
         query = query.where({ status: 'approved' });
      }
  
      query = query.populate({
          path: 'reviews.guestId',
          select: 'first_name last_name picture' 
      });
  
      const doc = await query.exec();
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
      res.json(doc);
    } catch (e) { next(e); }
  }
  
  export async function searchApproved(req, res, next) {
    try {
      const q = publicSearchSchema.parse(req.query);     
      const cond = { status: 'approved' };
      if (q.hostId) {
          if (mongoose.Types.ObjectId.isValid(q.hostId)) {
              cond.hostId = q.hostId;
          }
      }
      if (q.city) {
        cond.citySlug = q.city; 
      }
  
      if (q.q) {
          cond.title = { $regex: q.q, $options: 'i' };
      }
      if (q.minPrice || q.maxPrice) {
        cond['basePrice.amount'] = {};
        if (q.minPrice) cond['basePrice.amount'].$gte = Number(q.minPrice);
        if (q.maxPrice) cond['basePrice.amount'].$lte = Number(q.maxPrice);
      }
      if (q.amenities) {
        const arr = q.amenities.split(',').map(s => s.trim()).filter(Boolean);
        if (arr.length) {
            cond.amenities = { $all: arr };
        }
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
  
      doc.status = 'pending_review';
      doc.adminApproval = { status: 'pending_review' };
      await doc.save();
      res.json({ message: 'Unarchived -> pending_review' });
    } catch (e) { next(e); }
  }
  
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
      doc.status = 'pending_review';
      doc.adminApproval = { status: 'pending_review' };
      await doc.save();
  
      res.json({ message: 'Reordered', photos: doc.photos });
    } catch (e) { next(e); }
  }
  
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

  export async function adminGetOne(req, res, next) {
    try {
      const doc = await Listing.findById(req.params.id);
      if (!doc) return res.status(404).json({ message: 'Listing not found' });
      res.json(doc);
    } catch (e) { next(e); }
  }

  export async function adminUpdateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body; 
  
      const validStatuses = ['approved', 'suspended', 'pending_review', 'rejected', 'archived'];
      if (!validStatuses.includes(status)) {
          return res.status(400).json({ message: 'Invalid status' });
      }
  
      const doc = await Listing.findById(id);
      if (!doc) return res.status(404).json({ message: 'Listing not found' });

      doc.status = status;

      if (status === 'approved') {
          doc.adminApproval = {
              ...doc.adminApproval,
              status: 'approved',
              approvedBy: req.user._id,
              approvedAt: new Date()
          };
      } else if (status === 'suspended') {
          doc.adminApproval.note = "Suspended by Admin";
      }
  
      await doc.save();
      res.json({ message: `Updated status to ${status}`, listing: doc });
    } catch (e) {
      next(e);
    }
  }
