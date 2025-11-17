import mongoose from 'mongoose';

const { Schema } = mongoose;

// File reference schema (tái sử dụng từ user model)
const FileRefSchema = new Schema({
  bucket: String,
  region: String,
  key: String,
  url: String,
  contentType: String,
  size: Number,
  width: Number,
  height: Number
}, { _id: false });

const ChatMessageSchema = new Schema({
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: false, // Không bắt buộc, có thể chat không cần booking
    index: true
  },
  senderId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'voice'],
    default: 'text'
  },
  message: {
    type: String,
    required: function() {
      // Text message thì bắt buộc có message, file/image/voice thì không
      return this.messageType === 'text';
    },
    trim: true,
    default: ''
  },
  // File attachment (cho image, file, voice)
  file: {
    type: FileRefSchema,
    required: function() {
      // File/image/voice thì bắt buộc có file
      return ['image', 'file', 'voice'].includes(this.messageType);
    }
  },
  readAt: {
    type: Date,
    default: null
  },
  read: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Index để query nhanh các tin nhắn của một booking (nếu có)
ChatMessageSchema.index({ bookingId: 1, createdAt: -1 });
// Index để query tin nhắn chưa đọc
ChatMessageSchema.index({ receiverId: 1, read: 1, createdAt: -1 });
// Index để query conversation giữa 2 users
ChatMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
ChatMessageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
export default ChatMessage;

