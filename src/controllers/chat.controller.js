// src/controllers/chat.controller.js
import ChatMessage from '../models/chatMessage.model.js';
import User from '../models/user.model.js';
import Conversation from '../models/conversation.model.js'; 
import Listing from '../models/listing.model.js';
import Notification from '../models/notification.model.js';
export async function createOrGetConversation(req, res, next) {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (!receiverId) return res.status(400).json({ message: 'Receiver ID is required' });

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ message: 'Receiver not found' });

    if (senderId.toString() === receiverId.toString()) {
         return res.status(400).json({ message: 'Cannot chat with yourself' });
    }

    let conversation = await Conversation.findOne({
      members: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        members: [senderId, receiverId],
      });
    }
    
    await conversation.populate('members', 'first_name last_name picture email');
    res.json(conversation);
  } catch (e) {
    next(e);
  }
}

export async function getMessages(req, res, next) {
  try {
    const { conversationId } = req.params; 
    const { limit = 50, skip = 0 } = req.query;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ message: "Conversation not found" });

    const isMember = conversation.members.some(m => m.toString() === req.user._id.toString());
    if (!isMember) return res.status(403).json({ message: "Forbidden" });

    const member1 = conversation.members[0];
    const member2 = conversation.members[1];

    const messages = await ChatMessage.find({
      $or: [
        { senderId: member1, receiverId: member2 },
        { senderId: member2, receiverId: member1 }
      ],
      bookingId: null 
    })
      .populate('senderId', 'first_name last_name picture email')
      .sort({ createdAt: -1 }) 
      .limit(Number(limit))
      .skip(Number(skip));

    res.json(messages.reverse()); 
  } catch (e) {
    next(e);
  }
}

export async function sendMessage(req, res, next) {
    try {
        const { conversationId } = req.params;
        const { text, file, messageType = 'text' } = req.body; 
        const senderId = req.user._id;
        const senderName = req.user.first_name || "Người dùng";

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return res.status(404).json({ message: "Conversation not found" });

        const receiverId = conversation.members.find(m => m.toString() !== senderId.toString());

        const newMessage = await ChatMessage.create({
            senderId,
            receiverId,
            message: text || '', 
            messageType: messageType, 
            file: file || null, 
            read: false
        });

        let previewText = text;
        if (messageType === 'image') previewText = '[Hình ảnh]';
        else if (messageType === 'file') previewText = '[Tệp đính kèm]';
        else if (messageType === 'voice') previewText = '[Tin nhắn thoại]';

        conversation.lastMessage = {
            text: previewText || 'Tin nhắn mới',
            senderId,
            seen: false,
            createdAt: new Date()
        };
        await conversation.save();
        try {
             await Notification.create({
                userId: receiverId,
                message: `Tin nhắn mới từ ${senderName}: ${previewText}`,
                link: `?chatPartnerId=${senderId}` 
             });
        } catch (notifError) {
            console.error("Failed to create notification:", notifError);
        }
        
        await newMessage.populate('senderId', 'first_name last_name picture email');

        res.status(201).json(newMessage);
    } catch (e) {
        next(e);
    }
}

export async function getMyConversations(req, res, next) {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({ members: userId })
      .populate('members', 'first_name last_name picture email')
      .sort({ updatedAt: -1 });
      
    res.json({ items: conversations });
  } catch (e) { next(e); }
}

export async function getUnreadCount(req, res, next) {
  try {
    const count = await ChatMessage.countDocuments({
      receiverId: req.user._id,
      read: false
    });
    res.json({ unreadCount: count });
  } catch (e) { next(e); }
}

export async function markAllAsRead(req, res, next) {
  try {
    await ChatMessage.updateMany(
      { receiverId: req.user._id, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ message: 'All messages marked as read' });
  } catch (e) { next(e); }
}

export async function getAvailableUsers(req, res, next) {
  try {
    const userId = req.user._id;
    const isCurrentUserHost = req.user.roles?.includes('host');
    const { limit = 50, skip = 0, search = '' } = req.query;

    let query = { status: 'active', _id: { $ne: userId } };
    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (isCurrentUserHost) {
      query.roles = { $in: ['guest'] };
    } else {
      const hostIds = await Listing.distinct('hostId', { status: 'approved' });
      query._id = { $in: hostIds, $ne: userId }; 
      query.roles = { $in: ['host'] };
    }

    const users = await User.find(query)
      .select('_id first_name last_name picture email roles status')
      .limit(Number(limit)).skip(Number(skip)).sort({ createdAt: -1 });

    const total = await User.countDocuments(query);
    res.json({ items: users, total, limit: Number(limit), skip: Number(skip) });
  } catch (e) { next(e); }
}
export async function getConversationMessages(req, res, next) { next(); }
export async function markAsRead(req, res, next) { next(); }
export async function markConversationAllAsRead(req, res, next) { next(); }
export async function getUnreadCountByConversation(req, res, next) { next(); }
export async function getUnreadCountByBooking(req, res, next) { next(); }