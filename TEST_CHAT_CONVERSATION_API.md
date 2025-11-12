# Hướng dẫn Test Chat Conversation API

## 📋 Chuẩn bị

### 1. Khởi động server
```bash
npm run dev
```

### 2. Tạo 2 tài khoản để test (1 host, 1 guest)

**Tài khoản 1 - Guest:**
```bash
curl --location 'http://localhost:5001/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "guest@test.com",
    "password": "123456",
    "first_name": "Guest",
    "last_name": "User",
    "gender": "male"
}'
```

**Tài khoản 2 - Host:**
```bash
curl --location 'http://localhost:5001/api/auth/register' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "host@test.com",
    "password": "123456",
    "first_name": "Host",
    "last_name": "User",
    "gender": "male"
}'
```

**Lưu ý:** Sau khi tạo host, cần update role thành 'host' trong database hoặc dùng script seed.

### 3. Login để lấy Access Token

**Login Guest:**
```bash
curl --location 'http://localhost:5001/api/auth/login' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "guest@test.com",
    "password": "123456"
}'
```

**Login Host:**
```bash
curl --location 'http://localhost:5001/api/auth/login' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "host@test.com",
    "password": "123456"
}'
```

**Lưu lại `accessToken` từ response của mỗi tài khoản.**

---

## 🧪 Test bằng Postman

### Setup Postman Environment

1. Tạo Environment mới tên "Chat API"
2. Thêm các variables:
   - `base_url`: `http://localhost:5001`
   - `guest_token`: (paste token từ login guest)
   - `host_token`: (paste token từ login host)
   - `guest_id`: (sẽ lấy từ response)
   - `host_id`: (sẽ lấy từ response)
   - `receiver_id`: (sẽ dùng để test conversation)

### Collection: Chat Conversation API

#### 1. Get Conversations List
**Method:** `GET`  
**URL:** `{{base_url}}/api/chat/conversations`  
**Headers:**
```
Authorization: Bearer {{guest_token}}
```

**Expected Response:**
```json
{
  "items": [
    {
      "userId": "...",
      "first_name": "Host",
      "last_name": "User",
      "picture": null,
      "email": "host@test.com",
      "lastMessage": "Hello",
      "lastMessageAt": "2024-01-01T00:00:00.000Z",
      "unreadCount": 2,
      "bookingId": null
    }
  ],
  "total": 1
}
```

#### 2. Get Conversation Messages
**Method:** `GET`  
**URL:** `{{base_url}}/api/chat/conversations/{{receiver_id}}/messages?limit=50&skip=0`  
**Headers:**
```
Authorization: Bearer {{guest_token}}
```

**Query Params:**
- `limit`: 50 (optional)
- `skip`: 0 (optional)

**Expected Response:**
```json
{
  "items": [
    {
      "_id": "...",
      "senderId": {
        "_id": "...",
        "first_name": "Guest",
        "last_name": "User",
        "picture": null,
        "email": "guest@test.com"
      },
      "receiverId": {
        "_id": "...",
        "first_name": "Host",
        "last_name": "User",
        "picture": null,
        "email": "host@test.com"
      },
      "message": "Hello, I want to book your place",
      "read": false,
      "readAt": null,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "skip": 0,
  "receiver": {
    "_id": "...",
    "first_name": "Host",
    "last_name": "User",
    "picture": null,
    "email": "host@test.com"
  }
}
```

#### 3. Mark Conversation All as Read
**Method:** `PATCH`  
**URL:** `{{base_url}}/api/chat/conversations/{{receiver_id}}/messages/read-all`  
**Headers:**
```
Authorization: Bearer {{guest_token}}
```

**Expected Response:**
```json
{
  "message": "All conversation messages marked as read"
}
```

#### 4. Get Unread Count by Conversation
**Method:** `GET`  
**URL:** `{{base_url}}/api/chat/conversations/{{receiver_id}}/messages/unread-count`  
**Headers:**
```
Authorization: Bearer {{guest_token}}
```

**Expected Response:**
```json
{
  "unreadCount": 0
}
```

#### 5. Get Total Unread Count
**Method:** `GET`  
**URL:** `{{base_url}}/api/chat/messages/unread-count`  
**Headers:**
```
Authorization: Bearer {{guest_token}}
```

**Expected Response:**
```json
{
  "unreadCount": 5
}
```

#### 6. Mark Single Message as Read
**Method:** `PATCH`  
**URL:** `{{base_url}}/api/chat/messages/{{message_id}}/read`  
**Headers:**
```
Authorization: Bearer {{guest_token}}
```

**Expected Response:**
```json
{
  "message": "Marked as read",
  "data": {
    "_id": "...",
    "read": true,
    "readAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

## 🧪 Test bằng cURL

### 1. Get Conversations
```bash
curl --location 'http://localhost:5001/api/chat/conversations' \
--header 'Authorization: Bearer YOUR_GUEST_TOKEN'
```

### 2. Get Conversation Messages
```bash
curl --location 'http://localhost:5001/api/chat/conversations/RECEIVER_ID/messages?limit=50&skip=0' \
--header 'Authorization: Bearer YOUR_GUEST_TOKEN'
```

### 3. Mark All as Read
```bash
curl --location --request PATCH 'http://localhost:5001/api/chat/conversations/RECEIVER_ID/messages/read-all' \
--header 'Authorization: Bearer YOUR_GUEST_TOKEN'
```

### 4. Get Unread Count
```bash
curl --location 'http://localhost:5001/api/chat/conversations/RECEIVER_ID/messages/unread-count' \
--header 'Authorization: Bearer YOUR_GUEST_TOKEN'
```

---

## 🧪 Test WebSocket Conversation

### Sử dụng file test-chat.html

1. Mở `http://localhost:5001/test-chat.html`
2. Login với guest token
3. Connect WebSocket
4. Join conversation với host ID:
   ```javascript
   socket.emit('join-conversation', 'HOST_USER_ID');
   ```
5. Gửi tin nhắn:
   ```javascript
   socket.emit('send-message', {
     receiverId: 'HOST_USER_ID',
     message: 'Hello from guest!'
   });
   ```

### Test script Node.js

Tạo file `test-conversation.js`:

```javascript
import { io } from 'socket.io-client';

const guestToken = 'YOUR_GUEST_TOKEN';
const hostToken = 'YOUR_HOST_TOKEN';
const hostId = 'HOST_USER_ID';
const guestId = 'GUEST_USER_ID';

// Connect as Guest
const guestSocket = io('http://localhost:5001', {
  auth: { token: guestToken }
});

guestSocket.on('connect', () => {
  console.log('✅ Guest connected');
  guestSocket.emit('join-conversation', hostId);
});

guestSocket.on('joined-conversation', (data) => {
  console.log('✅ Guest joined conversation:', data);
  
  // Gửi tin nhắn
  setTimeout(() => {
    guestSocket.emit('send-message', {
      receiverId: hostId,
      message: 'Hello, I want to book your place!'
    });
  }, 1000);
});

guestSocket.on('new-message', (data) => {
  console.log('📨 Guest received:', data.message.message);
});

// Connect as Host
const hostSocket = io('http://localhost:5001', {
  auth: { token: hostToken }
});

hostSocket.on('connect', () => {
  console.log('✅ Host connected');
  hostSocket.emit('join-conversation', guestId);
});

hostSocket.on('joined-conversation', (data) => {
  console.log('✅ Host joined conversation:', data);
});

hostSocket.on('new-message', (data) => {
  console.log('📨 Host received:', data.message.message);
  
  // Trả lời
  setTimeout(() => {
    hostSocket.emit('send-message', {
      receiverId: guestId,
      message: 'Sure! When do you want to book?'
    });
  }, 2000);
});

// Keep alive
process.stdin.resume();
```

Chạy:
```bash
node test-conversation.js
```

---

## 📝 Test Flow Hoàn Chỉnh

### Bước 1: Setup
1. Tạo 2 tài khoản (guest và host)
2. Update host role thành 'host' trong database
3. Login cả 2 và lấy tokens

### Bước 2: Test REST API

**Guest gửi tin nhắn đầu tiên (qua WebSocket hoặc tạo trực tiếp trong DB):**

Sau đó test:
1. ✅ Get conversations list (guest)
2. ✅ Get conversation messages (guest)
3. ✅ Get unread count (host)
4. ✅ Mark all as read (host)
5. ✅ Verify unread count = 0

### Bước 3: Test WebSocket

**Terminal 1 - Guest:**
```bash
node test-conversation.js
```

**Terminal 2 - Host:**
```bash
node test-conversation.js
```

Hoặc mở 2 tab trình duyệt với `test-chat.html`

### Bước 4: Test Real-time

1. Guest gửi tin nhắn → Host nhận realtime
2. Host trả lời → Guest nhận realtime
3. Test typing indicator
4. Test mark as read

---

## 🔍 Kiểm tra Database

### Xem messages trong MongoDB:
```javascript
// Connect MongoDB
use your_database_name

// Xem tất cả messages
db.chatmessages.find().pretty()

// Xem messages của conversation (không có bookingId)
db.chatmessages.find({ bookingId: null }).pretty()

// Xem messages chưa đọc
db.chatmessages.find({ read: false }).pretty()
```

---

## 🐛 Troubleshooting

### Lỗi "Can only chat between host and guest"
- **Nguyên nhân:** Cả 2 users đều là host hoặc đều là guest
- **Giải pháp:** Đảm bảo 1 user có role 'host', 1 user có role 'guest'

### Lỗi "User not found"
- **Nguyên nhân:** receiverId không tồn tại
- **Giải pháp:** Kiểm tra ID có đúng không

### Không nhận được tin nhắn realtime
- **Nguyên nhân:** Chưa join conversation
- **Giải pháp:** Gọi `join-conversation` trước khi gửi tin nhắn

### Token hết hạn
- **Nguyên nhân:** Access token có thời hạn (15 phút)
- **Giải pháp:** Refresh token hoặc login lại

---

## 📊 Test Checklist

### REST API:
- [ ] Get conversations list
- [ ] Get conversation messages
- [ ] Mark all as read
- [ ] Get unread count by conversation
- [ ] Get total unread count
- [ ] Mark single message as read

### WebSocket:
- [ ] Connect với token
- [ ] Join conversation
- [ ] Send message (receiverId)
- [ ] Receive message realtime
- [ ] Typing indicator
- [ ] Mark all read via WebSocket
- [ ] Leave conversation

### Security:
- [ ] Không thể chat giữa 2 guests
- [ ] Không thể chat giữa 2 hosts
- [ ] Chỉ có thể xem conversation của mình
- [ ] Token hết hạn thì không kết nối được

---

## 💡 Tips

1. **Sử dụng Postman Collection:** Import các requests vào Postman để test nhanh
2. **Environment Variables:** Dùng variables để dễ thay đổi token/userId
3. **Test Scripts:** Tạo scripts để test tự động
4. **Database Check:** Kiểm tra database để verify data đúng
5. **Console Logs:** Xem server logs để debug

---

## 📚 API Reference

Xem file `CHAT_API.md` để biết chi tiết về tất cả endpoints và WebSocket events.

