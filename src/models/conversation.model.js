import mongoose from 'mongoose';
const { Schema } = mongoose;

const ConversationSchema = new Schema({
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  lastMessage: {
    text: String,
    senderId: { type: Schema.Types.ObjectId, ref: 'User' },
    seen: { type: Boolean, default: false },
    createdAt: Date
  }
}, { timestamps: true });
ConversationSchema.index({ members: 1 });

const Conversation = mongoose.model('Conversation', ConversationSchema);
export default Conversation;