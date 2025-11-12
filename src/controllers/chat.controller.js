import ChatMessage from '../models/chatMessage.model.js';
import Booking from '../models/booking.model.js';
import User from '../models/user.model.js';
import Listing from '../models/listing.model.js';

/**
 * Lấy danh sách tin nhắn của một conversation (giữa 2 users)
 * Không cần booking, chỉ cần receiverId
 */
export async function getConversationMessages(req, res, next) {
  try {
    const { receiverId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    // Kiểm tra receiver có tồn tại
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Kiểm tra: một trong 2 phải là host, một là guest
    const currentUser = req.user;
    const isCurrentUserHost = currentUser.roles?.includes('host');
    const isReceiverHost = receiver.roles?.includes('host');
    
    if (isCurrentUserHost === isReceiverHost) {
      return res.status(403).json({ message: 'Can only chat between host and guest' });
    }

    // Lấy tin nhắn giữa 2 users (không cần bookingId)
    const messages = await ChatMessage.find({
      $or: [
        { senderId: req.user._id, receiverId },
        { senderId: receiverId, receiverId: req.user._id }
      ],
      bookingId: null // Chỉ lấy tin nhắn không có booking
    })
      .populate('senderId', 'first_name last_name picture email')
      .populate('receiverId', 'first_name last_name picture email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    // Đếm tổng số tin nhắn
    const total = await ChatMessage.countDocuments({
      $or: [
        { senderId: req.user._id, receiverId },
        { senderId: receiverId, receiverId: req.user._id }
      ],
      bookingId: null
    });

    res.json({
      items: messages.reverse(), // Đảo ngược để hiển thị từ cũ đến mới
      total,
      limit: Number(limit),
      skip: Number(skip),
      receiver: {
        _id: receiver._id,
        first_name: receiver.first_name,
        last_name: receiver.last_name,
        picture: receiver.picture,
        email: receiver.email
      }
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách tin nhắn của một booking
 * Chỉ user hoặc host liên quan đến booking mới được xem
 * (Giữ lại để backward compatibility)
 */
export async function getMessages(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { limit = 50, skip = 0 } = req.query;

    // Kiểm tra booking có tồn tại và user có quyền xem
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Chỉ guest hoặc host của booking mới được xem
    const userId = req.user._id.toString();
    const isGuest = booking.guestId.toString() === userId;
    const isHost = booking.hostId.toString() === userId;

    if (!isGuest && !isHost) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Lấy tin nhắn
    const messages = await ChatMessage.find({
      bookingId,
      $or: [
        { senderId: req.user._id },
        { receiverId: req.user._id }
      ]
    })
      .populate('senderId', 'first_name last_name picture email')
      .populate('receiverId', 'first_name last_name picture email')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    // Đếm tổng số tin nhắn
    const total = await ChatMessage.countDocuments({
      bookingId,
      $or: [
        { senderId: req.user._id },
        { receiverId: req.user._id }
      ]
    });

    res.json({
      items: messages.reverse(), // Đảo ngược để hiển thị từ cũ đến mới
      total,
      limit: Number(limit),
      skip: Number(skip)
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Đánh dấu tin nhắn đã đọc
 */
export async function markAsRead(req, res, next) {
  try {
    const { messageId } = req.params;

    const message = await ChatMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Chỉ receiver mới được đánh dấu đã đọc
    if (message.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    message.read = true;
    message.readAt = new Date();
    await message.save();

    res.json({ message: 'Marked as read', data: message });
  } catch (e) {
    next(e);
  }
}

/**
 * Đánh dấu tất cả tin nhắn của một conversation là đã đọc
 */
export async function markConversationAllAsRead(req, res, next) {
  try {
    const { receiverId } = req.params;

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Kiểm tra: một trong 2 phải là host, một là guest
    const currentUser = req.user;
    const isCurrentUserHost = currentUser.roles?.includes('host');
    const isReceiverHost = receiver.roles?.includes('host');
    
    if (isCurrentUserHost === isReceiverHost) {
      return res.status(403).json({ message: 'Can only chat between host and guest' });
    }

    await ChatMessage.updateMany(
      {
        $or: [
          { senderId: receiverId, receiverId: req.user._id },
          { senderId: req.user._id, receiverId: receiverId }
        ],
        bookingId: null, // Chỉ đánh dấu tin nhắn không có booking
        receiverId: req.user._id,
        read: false
      },
      {
        $set: {
          read: true,
          readAt: new Date()
        }
      }
    );

    res.json({ message: 'All conversation messages marked as read' });
  } catch (e) {
    next(e);
  }
}

/**
 * Đánh dấu tất cả tin nhắn của một booking là đã đọc
 * (Giữ lại để backward compatibility)
 */
export async function markAllAsRead(req, res, next) {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const userId = req.user._id.toString();
    const isGuest = booking.guestId.toString() === userId;
    const isHost = booking.hostId.toString() === userId;

    if (!isGuest && !isHost) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await ChatMessage.updateMany(
      {
        bookingId,
        receiverId: req.user._id,
        read: false
      },
      {
        $set: {
          read: true,
          readAt: new Date()
        }
      }
    );

    res.json({ message: 'All messages marked as read' });
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy số tin nhắn chưa đọc
 */
export async function getUnreadCount(req, res, next) {
  try {
    const count = await ChatMessage.countDocuments({
      receiverId: req.user._id,
      read: false
    });

    res.json({ unreadCount: count });
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy số tin nhắn chưa đọc của một conversation cụ thể
 */
export async function getUnreadCountByConversation(req, res, next) {
  try {
    const { receiverId } = req.params;

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Kiểm tra: một trong 2 phải là host, một là guest
    const currentUser = req.user;
    const isCurrentUserHost = currentUser.roles?.includes('host');
    const isReceiverHost = receiver.roles?.includes('host');
    
    if (isCurrentUserHost === isReceiverHost) {
      return res.status(403).json({ message: 'Can only chat between host and guest' });
    }

    const count = await ChatMessage.countDocuments({
      $or: [
        { senderId: receiverId, receiverId: req.user._id },
        { senderId: req.user._id, receiverId: receiverId }
      ],
      bookingId: null, // Chỉ đếm tin nhắn không có booking
      receiverId: req.user._id,
      read: false
    });

    res.json({ unreadCount: count });
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy số tin nhắn chưa đọc của một booking cụ thể
 * (Giữ lại để backward compatibility)
 */
export async function getUnreadCountByBooking(req, res, next) {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const userId = req.user._id.toString();
    const isGuest = booking.guestId.toString() === userId;
    const isHost = booking.hostId.toString() === userId;

    if (!isGuest && !isHost) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const count = await ChatMessage.countDocuments({
      bookingId,
      receiverId: req.user._id,
      read: false
    });

    res.json({ unreadCount: count });
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách conversations (chỉ người đã từng nhắn tin)
 */
export async function getConversations(req, res, next) {
  try {
    const userId = req.user._id;
    const isCurrentUserHost = req.user.roles?.includes('host');
    const conversationsMap = new Map();

    // Lấy tất cả tin nhắn đã có (conversations đã tồn tại)
    const messages = await ChatMessage.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    })
      .populate('senderId', 'first_name last_name picture email roles')
      .populate('receiverId', 'first_name last_name picture email roles')
      .sort({ createdAt: -1 });

    messages.forEach(msg => {
      const otherUserId = msg.senderId._id.toString() === userId.toString() 
        ? msg.receiverId._id.toString() 
        : msg.senderId._id.toString();
      
      const otherUser = msg.senderId._id.toString() === userId.toString() 
        ? msg.receiverId 
        : msg.senderId;

      // Kiểm tra: một trong 2 phải là host, một là guest
      const isOtherUserHost = otherUser.roles?.includes('host');
      
      if (isCurrentUserHost === isOtherUserHost) {
        return; // Bỏ qua nếu không phải host-guest pair
      }

      if (!conversationsMap.has(otherUserId)) {
        // Đếm unread (chỉ tin nhắn conversation, không có bookingId)
        const unreadCount = messages.filter(m => 
          (m.senderId._id.toString() === otherUserId || m.receiverId._id.toString() === otherUserId) &&
          m.receiverId._id.toString() === userId.toString() &&
          !m.read &&
          !m.bookingId
        ).length;

        conversationsMap.set(otherUserId, {
          userId: otherUser._id,
          first_name: otherUser.first_name,
          last_name: otherUser.last_name,
          picture: otherUser.picture,
          email: otherUser.email,
          lastMessage: msg.message,
          lastMessageAt: msg.createdAt,
          unreadCount,
          bookingId: msg.bookingId || null
        });
      }
    });

    // Convert map to array và sort theo thời gian tin nhắn mới nhất
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }
        if (a.lastMessageAt) return -1;
        if (b.lastMessageAt) return 1;
        return 0;
      });

    res.json({ 
      items: conversations, 
      total: conversations.length 
    });
  } catch (e) {
    next(e);
  }
}

/**
 * Lấy danh sách users có thể chat (để chọn và bắt đầu chat mới)
 */
export async function getAvailableUsers(req, res, next) {
  try {
    const userId = req.user._id;
    const isCurrentUserHost = req.user.roles?.includes('host');
    const { limit = 50, skip = 0, search = '' } = req.query;

    let users = [];
    let query = {
      status: 'active',
      _id: { $ne: userId }
    };

    // Thêm search filter nếu có
    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (isCurrentUserHost) {
      // Host: Lấy danh sách guests
      query.roles = { $in: ['guest'] };
      users = await User.find(query)
        .select('_id first_name last_name picture email roles status')
        .limit(Number(limit))
        .skip(Number(skip))
        .sort({ createdAt: -1 });
    } else {
      // Guest: Lấy danh sách hosts (từ listings)
      const hostIds = await Listing.distinct('hostId', {
        status: 'approved'
      });
      
      query._id = { $in: hostIds };
      query.roles = { $in: ['host'] };
      
      users = await User.find(query)
        .select('_id first_name last_name picture email roles status')
        .limit(Number(limit))
        .skip(Number(skip))
        .sort({ createdAt: -1 });
    }

    // Đếm tổng
    const total = await User.countDocuments(query);

    res.json({
      items: users,
      total,
      limit: Number(limit),
      skip: Number(skip)
    });
  } catch (e) {
    next(e);
  }
}

