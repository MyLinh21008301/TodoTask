# Cấu hình CORS cho S3 Bucket

Để upload file từ browser lên S3, bạn cần cấu hình CORS cho S3 bucket.

## Cách cấu hình CORS cho S3 Bucket

### 1. Vào AWS Console
- Đăng nhập vào AWS Console
- Vào S3 service
- Chọn bucket của bạn

### 2. Cấu hình CORS
- Click vào tab **Permissions**
- Scroll xuống phần **Cross-origin resource sharing (CORS)**
- Click **Edit**
- Thêm cấu hình CORS sau:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:5001",
            "http://localhost:5173",
            "http://127.0.0.1:5001",
            "https://yourdomain.com"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

### 3. Lưu cấu hình
- Click **Save changes**

## Lưu ý

1. **AllowedOrigins**: Thay đổi `https://yourdomain.com` thành domain thực tế của bạn khi deploy production
2. **AllowedMethods**: Cần có `POST` để upload file
3. **AllowedHeaders**: `*` cho phép tất cả headers (hoặc có thể chỉ định cụ thể)
4. **MaxAgeSeconds**: Thời gian cache CORS preflight request (3000 giây = 50 phút)

## Kiểm tra CORS đã hoạt động

Sau khi cấu hình, thử upload file lại. Nếu vẫn gặp lỗi:

1. Kiểm tra browser console để xem lỗi chi tiết
2. Kiểm tra Network tab để xem request có được gửi không
3. Đảm bảo bucket policy cho phép upload (nếu có)
4. Kiểm tra IAM permissions cho AWS credentials

## Troubleshooting

### Lỗi: "CORS Missing Allow Origin"
- Kiểm tra `AllowedOrigins` có đúng domain không
- Đảm bảo không có trailing slash (ví dụ: `http://localhost:5001/` là sai)

### Lỗi: "Method not allowed"
- Kiểm tra `AllowedMethods` có `POST` không

### Lỗi: "Header not allowed"
- Thêm header vào `AllowedHeaders` hoặc dùng `*`

