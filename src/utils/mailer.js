import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false, // 587 = STARTTLS
  auth:{ user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

export async function sendOtpMail(to, code) {
  const appName = 'EazyStay';
  const ttl = process.env.EMAIL_OTP_TTL_MIN || 2;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif">
      <h2>${appName} – Xác thực email</h2>
      <p>Mã OTP của bạn:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</div>
      <p>Mã hết hạn sau <b>${ttl} phút</b>.</p>
    </div>`;
  await transporter.sendMail({
    from: `"${appName} Auth" <${process.env.SMTP_USER}>`,
    to, subject: `[${appName}] Mã xác thực email`, html
  });
}
export async function sendResetOtpMail(to, code) {
  const appName = 'EazyStay';
  const ttl = process.env.EMAIL_OTP_TTL_MIN || 10;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif">
      <h2>${appName} – Đặt lại mật khẩu</h2>
      <p>Mã OTP đặt lại mật khẩu của bạn:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</div>
      <p>Mã hết hạn sau <b>${ttl} phút</b>. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
    </div>`;
  await transporter.sendMail({
    from: `"${appName} Auth" <${process.env.SMTP_USER}>`,
    to, subject: `[${appName}] Mã OTP đặt lại mật khẩu`, html
  });
}
