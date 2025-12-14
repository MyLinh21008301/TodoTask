import mongoose from 'mongoose';

const { Schema } = mongoose;
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
    required: false, 
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
      return this.messageType === 'text';
    },
    trim: true,
    default: ''
  },
  file: {
    type: FileRefSchema,
    required: function() {
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

ChatMessageSchema.index({ bookingId: 1, createdAt: -1 });
// Index để query tin nhắn chưa đọc
ChatMessageSchema.index({ receiverId: 1, read: 1, createdAt: -1 });
// Index để query conversation giữa 2 users
ChatMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
ChatMessageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });

const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
export default ChatMessage;