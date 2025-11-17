// src/utils/text.js

export function toSlug(str = '') {
  if (!str) return '';
  
  let s = String(str);

  // 1. Bỏ dấu
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // 2. Bỏ 'đ'
  s = s.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  
  // 3. Bỏ tiền tố "Thành phố" hoặc "Tỉnh" (sau khi đã bỏ dấu)
  s = s.replace(/^Thanh pho\s*/i, '').replace(/^Tinh\s*/i, '');

  // 4. Chuyển sang chữ thường và dọn dẹp
  s = s.toLowerCase()
       .trim()
       .replace(/[^\w\s-]/g, '')       // Bỏ ký tự đặc biệt (giữ lại khoảng trắng và gạch nối)
       .replace(/[\s_-]+/g, '-');      // <-- THAY THẾ khoảng trắng bằng gạch nối

  return s;
}