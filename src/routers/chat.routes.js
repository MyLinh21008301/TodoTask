// src/routers/chat.routes.js
import express from 'express';
import { authGuard } from '../middlewares/authGuard.js';
import { 
  createOrGetConversation, 
  getMessages, 
  sendMessage, 
  getMyConversations
} from '../controllers/chat.controller.js';

const router = express.Router();

router.use(authGuard);

// 1. Tạo/Lấy hội thoại
router.post('/conversations', createOrGetConversation);

// 2. Lấy danh sách hội thoại
router.get('/conversations', getMyConversations);

// 3. Lấy tin nhắn (QUAN TRỌNG: Tham số là :conversationId)
router.get('/messages/:conversationId', getMessages);

// 4. Gửi tin nhắn
router.post('/messages/:conversationId', sendMessage);

export default router;