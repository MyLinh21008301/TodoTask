// src/services/chat.socket.js
import mongoose from 'mongoose';
import { verifyAccess } from '../utils/jwt.js';
import User from '../models/user.model.js';
import ChatMessage from '../models/chatMessage.model.js';
import Booking from '../models/booking.model.js';
import Conversation from '../models/conversation.model.js'; // Import thêm model này

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

// /**
//  * Setup Socket.IO handlers cho chat
//  */
// export function setupChatSocket(io) {
//   // Middleware xác thực
//   io.use(authenticateSocket);

//   io.on('connection', (socket) => {
//     console.log(`User connected: ${socket.userId}`);

//     // === QUAN TRỌNG: JOIN ROOM CÁ NHÂN ĐỂ NHẬN THÔNG BÁO ===
//     socket.join(`user:${socket.userId}`);
//     console.log(`User ${socket.userId} joined room user:${socket.userId}`);
//     // ========================================================

//     // Join conversation giữa 2 users
//     socket.on('join-conversation', async (otherUserId) => {
//       try {
//         // Logic cũ giữ nguyên...
//         const conversationId = getConversationId(socket.userId, otherUserId);
//         socket.join(conversationId);
//         console.log(`User ${socket.userId} joined conversation with ${otherUserId}`);
//       } catch (error) {
//         socket.emit('error', { message: error.message });
//       }
//     });

//     // Gửi tin nhắn (Sửa lại để gửi Notification)
//     socket.on('send-message', async (data) => {
//       try {
//         const { receiverId, message, messageType = 'text', file } = data;
//         const userId = socket.userId;
//         const roomId = getConversationId(userId, receiverId);

//         // Lưu tin nhắn vào database (như cũ)
//         const messageData = {
//           senderId: new mongoose.Types.ObjectId(userId),
//           receiverId: new mongoose.Types.ObjectId(receiverId),
//           messageType: messageType || 'text',
//           message: messageType === 'text' ? (message || '').trim() : (message || '').trim(),
//           file: file || null,
//           read: false,
//           bookingId: null
//         };
//         const chatMessage = await ChatMessage.create(messageData);
//         await chatMessage.populate('senderId', 'first_name last_name picture email');

//         // 1. Gửi tin nhắn vào phòng chat
//         io.to(roomId).emit('new-message', { message: chatMessage });

//         // 2. Gửi THÔNG BÁO (Notification) cho người nhận
//         // Emit vào room cá nhân của người nhận: user:RECEIVER_ID
//         const notifContent = messageType === 'image' ? '[Hình ảnh]' : (message || 'Tin nhắn mới');
//         io.to(`user:${receiverId}`).emit('new-notification', {
//              message: `Tin nhắn mới từ ${socket.user.first_name || 'User'}: ${notifContent}`,
//              type: 'chat',
//              senderId: userId
//         });

//       } catch (error) {
//         console.error('Error sending message:', error);
//         socket.emit('error', { message: error.message });
//       }
//     });

//     // Disconnect
//     socket.on('disconnect', () => {
//       console.log(`User disconnected: ${socket.userId}`);
//     });
//   });
// }

export function setupChatSocket(io) {
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    socket.join(`user:${socket.userId}`);

    socket.on('join-conversation', async (otherUserId) => {
      try {
        const conversationId = getConversationId(socket.userId, otherUserId);
        socket.join(conversationId);
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // --- SỬA ĐOẠN NÀY ---
    socket.on('send-message', async (data) => {
      try {
        const { receiverId, message, messageType = 'text', file } = data;
        const userId = socket.userId;
        const roomId = getConversationId(userId, receiverId);

        // 1. Lưu tin nhắn vào DB ChatMessage
        const messageData = {
          senderId: new mongoose.Types.ObjectId(userId),
          receiverId: new mongoose.Types.ObjectId(receiverId),
          messageType: messageType || 'text',
          message: messageType === 'text' ? (message || '').trim() : '',
          file: file || null,
          read: false,
          bookingId: null
        };
        const chatMessage = await ChatMessage.create(messageData);
        await chatMessage.populate('senderId', 'first_name last_name picture email');

        // 2. [MỚI] Xác định nội dung hiển thị cho lastMessage
        let previewText = message || '';
        if (messageType === 'image') previewText = '[Hình ảnh]';
        else if (messageType === 'voice') previewText = '[Đoạn ghi âm]';
        else if (messageType === 'file') previewText = '[Tệp đính kèm]';

        // 3. [MỚI] Cập nhật Conversation trong DB để lưu lastMessage
        const conversation = await Conversation.findOneAndUpdate(
          { members: { $all: [userId, receiverId] } },
          {
            $set: {
              lastMessage: {
                text: previewText,
                senderId: userId,
                seen: false, // Người nhận chưa xem
                createdAt: new Date(),
                type: messageType // Lưu thêm type để FE dễ xử lý icon
              }
            }
          },
          { new: true, upsert: true } // Nếu chưa có thì tạo mới (an toàn)
        );

        // 4. Chuẩn bị dữ liệu gửi về Client
        // Frontend cần 'conversationId' là _id của document Conversation (chứ không phải string roomId)
        // để khớp với selectedConv._id
        const payloadToEmit = {
            ...chatMessage.toObject(),
            conversationId: conversation._id // Quan trọng!
        };

        // 5. Gửi tin nhắn vào phòng chat (Realtime)
        io.to(roomId).emit('new-message', { message: payloadToEmit });

        // 6. Gửi Notification cho người nhận
        io.to(`user:${receiverId}`).emit('new-notification', {
             message: `Tin nhắn mới từ ${socket.user.first_name || 'User'}: ${previewText}`,
             type: 'chat',
             senderId: userId
        });

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
}