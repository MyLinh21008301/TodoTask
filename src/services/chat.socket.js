import mongoose from 'mongoose';
import { verifyAccess } from '../utils/jwt.js';
import User from '../models/user.model.js';
import ChatMessage from '../models/chatMessage.model.js';
import Booking from '../models/booking.model.js';

/**
 * Tạo conversationId từ 2 userIds (sắp xếp để consistent)
 */
function getConversationId(userId1, userId2) {
  const ids = [userId1.toString(), userId2.toString()].sort();
  return `conversation:${ids[0]}:${ids[1]}`;
}

/**
 * Xác thực user từ Socket.IO handshake
 */
export async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const payload = verifyAccess(token);
    const user = await User.findById(payload.sub);
    
    if (!user || user.status !== 'active') {
      return next(new Error('Authentication error: Invalid user'));
    }

    // Gắn user vào socket để dùng sau
    socket.userId = user._id.toString();
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
}

/**
 * Setup Socket.IO handlers cho chat
 */
export function setupChatSocket(io) {
  // Middleware xác thực
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join conversation giữa 2 users (không cần booking)
    socket.on('join-conversation', async (otherUserId) => {
      try {
        const otherUser = await User.findById(otherUserId);
        if (!otherUser) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        // Kiểm tra: một trong 2 phải là host, một là guest
        const currentUser = socket.user;
        const isCurrentUserHost = currentUser.roles?.includes('host');
        const isOtherUserHost = otherUser.roles?.includes('host');
        
        // Phải có 1 host và 1 guest
        if (isCurrentUserHost === isOtherUserHost) {
          socket.emit('error', { message: 'Can only chat between host and guest' });
          return;
        }

        const conversationId = getConversationId(socket.userId, otherUserId);
        socket.join(conversationId);
        console.log(`User ${socket.userId} joined conversation with ${otherUserId}`);

        socket.emit('joined-conversation', { 
          conversationId,
          otherUserId,
          otherUser: {
            _id: otherUser._id,
            first_name: otherUser.first_name,
            last_name: otherUser.last_name,
            picture: otherUser.picture,
            email: otherUser.email
          }
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Leave conversation
    socket.on('leave-conversation', (otherUserId) => {
      const conversationId = getConversationId(socket.userId, otherUserId);
      socket.leave(conversationId);
      console.log(`User ${socket.userId} left conversation with ${otherUserId}`);
    });

    // Join room cho các booking mà user tham gia (giữ lại để backward compatibility)
    socket.on('join-booking', async (bookingId) => {
      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        const userId = socket.userId;
        const isGuest = booking.guestId.toString() === userId;
        const isHost = booking.hostId.toString() === userId;

        if (!isGuest && !isHost) {
          socket.emit('error', { message: 'Forbidden' });
          return;
        }

        // Join room với tên là bookingId
        socket.join(`booking:${bookingId}`);
        console.log(`User ${socket.userId} joined booking:${bookingId}`);

        socket.emit('joined-booking', { bookingId });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Leave booking room
    socket.on('leave-booking', (bookingId) => {
      socket.leave(`booking:${bookingId}`);
      console.log(`User ${socket.userId} left booking:${bookingId}`);
    });

    // Gửi tin nhắn (hỗ trợ cả conversation và booking, text/image/file/voice)
    socket.on('send-message', async (data) => {
      try {
        const { receiverId, bookingId, message, messageType = 'text', file } = data;

        // Validate: text message cần có message, file/image/voice cần có file
        if (messageType === 'text' && (!message || !message.trim())) {
          socket.emit('error', { message: 'Text message is required' });
          return;
        }
        
        if (['image', 'file', 'voice'].includes(messageType) && !file) {
          socket.emit('error', { message: 'File is required for this message type' });
          return;
        }

        const userId = socket.userId;
        let finalReceiverId = null;
        let roomId = null;
        let bookingObj = null;

        // Trường hợp 1: Có receiverId (chat trực tiếp, không cần booking)
        if (receiverId) {
          const receiver = await User.findById(receiverId);
          if (!receiver) {
            socket.emit('error', { message: 'Receiver not found' });
            return;
          }

          // Kiểm tra: một trong 2 phải là host, một là guest
          const currentUser = socket.user;
          const isCurrentUserHost = currentUser.roles?.includes('host');
          const isReceiverHost = receiver.roles?.includes('host');
          
          if (isCurrentUserHost === isReceiverHost) {
            socket.emit('error', { message: 'Can only chat between host and guest' });
            return;
          }

          finalReceiverId = new mongoose.Types.ObjectId(receiverId);
          roomId = getConversationId(userId, receiverId);
        }
        // Trường hợp 2: Có bookingId (chat trong booking - backward compatibility)
        else if (bookingId) {
          bookingObj = await Booking.findById(bookingId);
          if (!bookingObj) {
            socket.emit('error', { message: 'Booking not found' });
            return;
          }

          const isGuest = bookingObj.guestId.toString() === userId;
          const isHost = bookingObj.hostId.toString() === userId;

          if (!isGuest && !isHost) {
            socket.emit('error', { message: 'Forbidden' });
            return;
          }

          finalReceiverId = isGuest ? bookingObj.hostId : bookingObj.guestId;
          roomId = `booking:${bookingId}`;
        } else {
          socket.emit('error', { message: 'Either receiverId or bookingId is required' });
          return;
        }

        // Lưu tin nhắn vào database
        const messageData = {
          bookingId: bookingObj ? new mongoose.Types.ObjectId(bookingId) : null,
          senderId: new mongoose.Types.ObjectId(userId),
          receiverId: finalReceiverId,
          messageType: messageType || 'text',
          message: messageType === 'text' ? (message || '').trim() : (message || '').trim(), // Có thể có caption cho image/file
          read: false
        };

        // Thêm file nếu có
        if (file && ['image', 'file', 'voice'].includes(messageType)) {
          messageData.file = file;
        }

        const chatMessage = await ChatMessage.create(messageData);

        // Populate để gửi thông tin đầy đủ
        await chatMessage.populate('senderId', 'first_name last_name picture email');
        await chatMessage.populate('receiverId', 'first_name last_name picture email');

        // Gửi tin nhắn đến tất cả clients trong room (bao gồm cả sender)
        io.to(roomId).emit('new-message', {
          message: chatMessage
        });

        // Gửi thông báo đến receiver nếu họ không online trong room này
        socket.to(roomId).emit('message-notification', {
          receiverId: finalReceiverId.toString(),
          bookingId: bookingId || null,
          message: chatMessage,
          unreadCount: await ChatMessage.countDocuments({
            receiverId: finalReceiverId,
            read: false
          })
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: error.message });
      }
    });

    // Đánh dấu tin nhắn đã đọc
    socket.on('mark-message-read', async (messageId) => {
      try {
        const message = await ChatMessage.findById(messageId);
        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Chỉ receiver mới được đánh dấu đã đọc
        if (message.receiverId.toString() !== socket.userId) {
          socket.emit('error', { message: 'Forbidden' });
          return;
        }

        message.read = true;
        message.readAt = new Date();
        await message.save();

        // Thông báo cho tất cả clients trong room
        const roomId = message.bookingId 
          ? `booking:${message.bookingId}` 
          : getConversationId(message.senderId.toString(), message.receiverId.toString());
        io.to(roomId).emit('message-read', {
          messageId: message._id,
          readAt: message.readAt
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Đánh dấu tất cả tin nhắn đã đọc (hỗ trợ cả conversation và booking)
    socket.on('mark-all-read', async (data) => {
      try {
        const { receiverId, bookingId } = data || {};
        let roomId = null;
        let query = {
          receiverId: socket.userId,
          read: false
        };

        if (receiverId) {
          // Mark all read trong conversation
          const otherUser = await User.findById(receiverId);
          if (!otherUser) {
            socket.emit('error', { message: 'User not found' });
            return;
          }

          const currentUser = socket.user;
          const isCurrentUserHost = currentUser.roles?.includes('host');
          const isOtherUserHost = otherUser.roles?.includes('host');
          
          if (isCurrentUserHost === isOtherUserHost) {
            socket.emit('error', { message: 'Can only chat between host and guest' });
            return;
          }

          query.$or = [
            { senderId: new mongoose.Types.ObjectId(receiverId), receiverId: socket.userId },
            { senderId: socket.userId, receiverId: new mongoose.Types.ObjectId(receiverId) }
          ];
          roomId = getConversationId(socket.userId, receiverId);
        } else if (bookingId) {
          // Mark all read trong booking (backward compatibility)
          const booking = await Booking.findById(bookingId);
          if (!booking) {
            socket.emit('error', { message: 'Booking not found' });
            return;
          }

          const userId = socket.userId;
          const isGuest = booking.guestId.toString() === userId;
          const isHost = booking.hostId.toString() === userId;

          if (!isGuest && !isHost) {
            socket.emit('error', { message: 'Forbidden' });
            return;
          }

          query.bookingId = bookingId;
          roomId = `booking:${bookingId}`;
        } else {
          socket.emit('error', { message: 'Either receiverId or bookingId is required' });
          return;
        }

        await ChatMessage.updateMany(query, {
          $set: {
            read: true,
            readAt: new Date()
          }
        });

        // Thông báo cho tất cả clients trong room
        io.to(roomId).emit('all-messages-read', {
          receiverId: receiverId || null,
          bookingId: bookingId || null,
          userId: socket.userId
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Typing indicator (hỗ trợ cả conversation và booking)
    socket.on('typing', (data) => {
      const { receiverId, bookingId } = data;
      let roomId = null;
      
      if (receiverId) {
        roomId = getConversationId(socket.userId, receiverId);
      } else if (bookingId) {
        roomId = `booking:${bookingId}`;
      } else {
        return;
      }

      socket.to(roomId).emit('user-typing', {
        userId: socket.userId,
        receiverId: receiverId || null,
        bookingId: bookingId || null
      });
    });

    socket.on('stop-typing', (data) => {
      const { receiverId, bookingId } = data;
      let roomId = null;
      
      if (receiverId) {
        roomId = getConversationId(socket.userId, receiverId);
      } else if (bookingId) {
        roomId = `booking:${bookingId}`;
      } else {
        return;
      }

      socket.to(roomId).emit('user-stop-typing', {
        userId: socket.userId,
        receiverId: receiverId || null,
        bookingId: bookingId || null
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
}

