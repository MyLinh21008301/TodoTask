// src/models/notification.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const NotificationSchema = new Schema({
  // ID của người sẽ nhận thông báo (ví dụ: guest)
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  
  // Nội dung thông báo
  message: { 
    type: String, 
    required: true 
  },
  
  // Trạng thái đã đọc (để hiển thị số trên chuông)
  read: { 
    type: Boolean, 
    default: false, 
    index: true 
  },
  
  // Đường dẫn để điều hướng khi nhấn vào
  // Ví dụ: /my-bookings/6912c01658a74d907c523164
  link: { 
    type: String 
  }
}, { 
  timestamps: true // Tự động thêm createdAt, updatedAt
});

// Index để tìm kiếm thông báo của 1 user và sắp xếp nhanh
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;