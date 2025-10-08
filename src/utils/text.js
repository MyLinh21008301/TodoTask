export function toSlug(str = '') {
    return String(str)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')   // bỏ dấu
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase()
      .trim();
  }
  