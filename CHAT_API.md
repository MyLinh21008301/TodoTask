# Chat API Documentation

## Tổng quan
Hệ thống chat realtime giữa User (customer) và Host sử dụng WebSocket (Socket.IO) và REST API.

## REST API Endpoints

### 1. Lấy danh sách tin nhắn của một booking
```
GET /api/chat/bookings/:bookingId/messages
Query params: ?limit=50&skip=0
Headers: Authorization: Bearer <token>
```

Response:
```json
{
  "items": [
    {
      "_id": "...",
      "bookingId": "...",
      "senderId": { "_id": "...", "first_name": "...", "last_name": "...", "picture": "..." },
      "receiverId": { "_id": "...", "first_name": "...", "last_name": "...", "picture": "..." },
      "message": "Hello",
      "read": false,
      "readAt": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "total": 10,
  "limit": 50,
  "skip": 0
}
```

### 2. Đánh dấu một tin nhắn đã đọc
```
PATCH /api/chat/messages/:messageId/read
Headers: Authorization: Bearer <token>
```

### 3. Đánh dấu tất cả tin nhắn của booking đã đọc
```
PATCH /api/chat/bookings/:bookingId/messages/read-all
Headers: Authorization: Bearer <token>
```

### 4. Lấy số tin nhắn chưa đọc (tổng)
```
GET /api/chat/messages/unread-count
Headers: Authorization: Bearer <token>
```

Response:
```json
{
  "unreadCount": 5
}
```

### 5. Lấy số tin nhắn chưa đọc của một booking
```
GET /api/chat/bookings/:bookingId/messages/unread-count
Headers: Authorization: Bearer <token>
```

## WebSocket API (Socket.IO)

### Kết nối
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5001', {
  auth: {
    token: 'YOUR_ACCESS_TOKEN' // JWT access token
  },
  // Hoặc có thể dùng headers
  extraHeaders: {
    Authorization: 'Bearer YOUR_ACCESS_TOKEN'
  }
});
```

### Events

#### 1. Join booking room
Tham gia room để nhận/gửi tin nhắn của một booking cụ thể.

```javascript
socket.emit('join-booking', bookingId);

socket.on('joined-booking', (data) => {
  console.log('Joined booking:', data.bookingId);
});

socket.on('error', (error) => {
  console.error('Socket error:', error.message);
});
```

#### 2. Leave booking room
Rời khỏi room.

```javascript
socket.emit('leave-booking', bookingId);
```

#### 3. Gửi tin nhắn
```javascript
socket.emit('send-message', {
  bookingId: '...',
  message: 'Hello, how are you?'
});

socket.on('new-message', (data) => {
  console.log('New message:', data.message);
  // data.message chứa thông tin đầy đủ của tin nhắn
});

socket.on('message-notification', (data) => {
  // Nhận thông báo khi có tin nhắn mới (chỉ cho receiver)
  console.log('New message notification:', data);
  console.log('Unread count:', data.unreadCount);
});
```

#### 4. Đánh dấu tin nhắn đã đọc
```javascript
socket.emit('mark-message-read', messageId);

socket.on('message-read', (data) => {
  console.log('Message marked as read:', data.messageId);
});
```

#### 5. Đánh dấu tất cả tin nhắn đã đọc
```javascript
socket.emit('mark-all-read', bookingId);

socket.on('all-messages-read', (data) => {
  console.log('All messages marked as read for booking:', data.bookingId);
});
```

#### 6. Typing indicator
```javascript
// Bắt đầu gõ
socket.emit('typing', { bookingId: '...' });

// Dừng gõ
socket.emit('stop-typing', { bookingId: '...' });

// Nhận thông báo ai đang gõ
socket.on('user-typing', (data) => {
  console.log('User typing:', data.userId);
});

socket.on('user-stop-typing', (data) => {
  console.log('User stopped typing:', data.userId);
});
```

#### 7. Disconnect
```javascript
socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
```

## Ví dụ sử dụng trong React

```javascript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function ChatComponent({ bookingId, token }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    // Kết nối Socket.IO
    const newSocket = io('http://localhost:5001', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      // Join booking room
      newSocket.emit('join-booking', bookingId);
    });

    // Lắng nghe tin nhắn mới
    newSocket.on('new-message', (data) => {
      setMessages(prev => [...prev, data.message]);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.emit('leave-booking', bookingId);
      newSocket.disconnect();
    };
  }, [bookingId, token]);

  const sendMessage = () => {
    if (socket && inputMessage.trim()) {
      socket.emit('send-message', {
        bookingId,
        message: inputMessage
      });
      setInputMessage('');
    }
  };

  return (
    <div>
      <div className="messages">
        {messages.map(msg => (
          <div key={msg._id}>
            <strong>{msg.senderId.first_name}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <input
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

## Lưu ý

1. **Authentication**: Tất cả WebSocket connections đều cần JWT access token
2. **Authorization**: Chỉ user (guest) và host liên quan đến booking mới có thể xem/gửi tin nhắn
3. **Rooms**: Mỗi booking có một room riêng với format `booking:${bookingId}`
4. **Read status**: Tin nhắn được đánh dấu đã đọc khi receiver xem hoặc đánh dấu thủ công
5. **Reconnection**: Socket.IO tự động reconnect khi mất kết nối

