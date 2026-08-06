import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
  tls: {
    ciphers: 'SSLv3',
  },
});

export async function sendOtpEmail(params: {
  otp: string;
  otpType: 'code' | 'link';
  otpFrom: string;
  senderPhone: string;
  senderName: string;
  receiverPhone: string;
  messageBody: string;
  timestamp: string;
}): Promise<void> {
  const { otp, otpType, otpFrom, senderPhone, senderName, receiverPhone, messageBody, timestamp } = params;

  const abbrOtpFrom = otpFrom === "Whatsapp" ? "WA" : "SMS"
  const isLink = otpType === 'link';
  const subject = `[${abbrOtpFrom} OTP] ${isLink ? 'Link Verifikasi' : otp} — diterima di ${receiverPhone}`;

  const otpDisplay = isLink
    ? `<a href="${otp}" style="font-size:16px;color:#1565c0;">${otp}</a>`
    : `<span style="font-size:24px;font-weight:bold;color:#d32f2f;">${otp}</span>`;

  const html = `
    <h2>${otpFrom} OTP Terdeteksi</h2>
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
      <tr><td><b>Tipe OTP</b></td><td>${isLink ? 'Link Verifikasi' : 'Kode Angka'}</td></tr>
      <tr><td><b>${isLink ? 'Link' : 'Kode OTP'}</b></td><td>${otpDisplay}</td></tr>
      <tr><td><b>Nomor Penerima</b></td><td>${receiverPhone}</td></tr>
      <tr><td><b>Pengirim</b></td><td>${senderPhone} (${senderName})</td></tr>
      <tr><td><b>Isi Pesan</b></td><td>${messageBody}</td></tr>
      <tr><td><b>Waktu</b></td><td>${timestamp}</td></tr>
    </table>
    <p style="color:#888;font-size:12px;margin-top:16px;">
      Dikirim otomatis oleh WA OTP Receiver
    </p>
  `;

  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'WA OTP Receiver'}" <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME}>`,
    to: process.env.MAIL_TO,
    cc: process.env.MAIL_CC,
    subject,
    html,
  });
}
