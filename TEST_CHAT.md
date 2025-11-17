# Hướng dẫn Test Chat API

## Cách 1: Sử dụng file HTML test (Khuyến nghị)

1. **Khởi động server:**
   ```bash
   npm run dev
   ```

2. **Mở trình duyệt và truy cập:**
   ```
   http://localhost:5001/test-chat.html
   ```

3. **Các bước test:**
   - **Bước 1:** Login hoặc paste JWT token vào ô "Access Token"
   - **Bước 2:** Click "Connect WebSocket" để kết nối Socket.IO
   - **Bước 3:** Nhập Booking ID và click "Join Booking"
   - **Bước 4:** Gửi tin nhắn và xem realtime

## Cách 2: Test bằng cURL (Command Line)

### 1. Login để lấy token
```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user1@test.com","password":"Secret@123"}' \
  -c cookies.txt
```

Lưu access token từ response (ví dụ: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

### 2. Lấy danh sách tin nhắn
```bash
curl -X GET "http://localhost:5001/api/chat/bookings/BOOKING_ID/messages?limit=50&skip=0" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Đánh dấu tất cả tin nhắn đã đọc
```bash
curl -X PATCH "http://localhost:5001/api/chat/bookings/BOOKING_ID/messages/read-all" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Lấy số tin nhắn chưa đọc
```bash
curl -X GET "http://localhost:5001/api/chat/messages/unread-count" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Cách 3: Test bằng Postman

### Setup:
1. Tạo collection mới tên "Chat API"
2. Set environment variable: `base_url = http://localhost:5001`
3. Set environment variable: `token = YOUR_ACCESS_TOKEN`

### Test Cases:

#### 1. Login
- **Method:** POST
- **URL:** `{{base_url}}/api/auth/login`
- **Body (JSON):**
  ```json
  {
    "email": "user1@test.com",
    "password": "Secret@123"
  }
  ```
- **Save token từ response vào environment variable**

#### 2. Get Messages
- **Method:** GET
- **URL:** `{{base_url}}/api/chat/bookings/{{bookingId}}/messages?limit=50&skip=0`
- **Headers:**
  ```
  Authorization: Bearer {{token}}
  ```

#### 3. Mark All Read
- **Method:** PATCH
- **URL:** `{{base_url}}/api/chat/bookings/{{bookingId}}/messages/read-all`
- **Headers:**
  ```
  Authorization: Bearer {{token}}
  ```

#### 4. Unread Count
- **Method:** GET
- **URL:** `{{base_url}}/api/chat/messages/unread-count`
- **Headers:**
  ```
  Authorization: Bearer {{token}}
  ```

## Cách 4: Test WebSocket bằng Node.js script

Tạo file `test-websocket.js`:

```javascript
import { io } from 'socket.io-client';

const token = 'YOUR_ACCESS_TOKEN'; // Thay bằng token thật
const bookingId = 'YOUR_BOOKING_ID'; // Thay bằng booking ID thật

const socket = io('http://localhost:5001', {
  auth: { token }
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  
  // Join booking
  socket.emit('join-booking', bookingId);
  
  // Gửi tin nhắn sau 2 giây
  setTimeout(() => {
    socket.emit('send-message', {
      bookingId,
      message: 'Hello from test script!'
    });
  }, 2000);
});

socket.on('joined-booking', (data) => {
  console.log('✅ Joined booking:', data.bookingId);
});

socket.on('new-message', (data) => {
  console.log('📨 New message:', data.message);
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});

// Giữ script chạy
process.stdin.resume();
```

Chạy:
```bash
node test-websocket.js
```

## Cách 5: Test với 2 users (User và Host)

Để test chat giữa user và host, bạn cần:

1. **Tạo 2 tài khoản:**
   - User 1 (guest): `user1@test.com`
   - User 2 (host): `host1@test.com`

2. **Tạo một booking:**
   - User 1 tạo booking với listing của User 2 (host)

3. **Mở 2 tab trình duyệt:**
   - Tab 1: Login với User 1, mở `test-chat.html`
   - Tab 2: Login với User 2 (host), mở `test-chat.html`

4. **Cả 2 cùng join booking và chat với nhau**

## Checklist Test

### REST API:
- [ ] Login thành công và lấy được token
- [ ] Get messages trả về danh sách tin nhắn
- [ ] Mark all read thành công
- [ ] Unread count trả về đúng số lượng

### WebSocket:
- [ ] Kết nối thành công với token
- [ ] Join booking room thành công
- [ ] Gửi tin nhắn và nhận được realtime
- [ ] Typing indicator hoạt động
- [ ] Mark message read hoạt động
- [ ] Nhận notification khi có tin nhắn mới

### Security:
- [ ] Không thể xem tin nhắn của booking khác
- [ ] Token hết hạn thì không kết nối được
- [ ] Chỉ guest và host của booking mới join được room

## Troubleshooting

### Lỗi "Unauthorized"
- Kiểm tra token có đúng không
- Token có thể đã hết hạn, cần refresh

### WebSocket không kết nối được
- Kiểm tra server có chạy không
- Kiểm tra CORS settings trong `server.js`
- Kiểm tra token trong auth object

### Không nhận được tin nhắn
- Kiểm tra đã join booking room chưa
- Kiểm tra bookingId có đúng không
- Kiểm tra console log để xem có lỗi gì

### Tin nhắn không lưu vào database
- Kiểm tra MongoDB connection
- Kiểm tra ChatMessage model có đúng không
- Xem server logs để biết lỗi chi tiết

