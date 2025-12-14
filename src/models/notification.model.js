// src/models/notification.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const NotificationSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },

  message: { 
    type: String, 
    required: true 
  },
  read: { 
    type: Boolean, 
    default: false, 
    index: true 
  },
  link: { 
    type: String 
  }
}, { 
  timestamps: true 
});

NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;