import { extractOtp } from '../otp-extractor.js';
import { sendOtpEmail } from '../mailer.js';

/**
 * Payload yang dikirim OTP Forwarder App (Android NotificationListenerService)
 * setiap kali WhatsApp memunculkan notifikasi.
 */
export interface NotificationPayload {
  /** Nomor penerima (nomor emulator yang jadi primary device) */
  phone: string;
  /** Judul notifikasi WhatsApp (biasanya nama pengirim, mis. "Shopee Security") */
  title?: string;
  /** Isi teks notifikasi (di sinilah OTP berada) */
  text: string;
  /** Nama package sumber notif (filter: hanya com.whatsapp / com.whatsapp.w4b) */
  packageName?: string;
  /** Epoch ms saat notif muncul (opsional) */
  postedAt?: number;
}

const WHATSAPP_PACKAGES = ['com.whatsapp', 'com.whatsapp.w4b'];

export interface IngestResult {
  status: 'sent' | 'no_otp' | 'ignored';
  otp?: string;
  otpType?: 'code' | 'link';
}

/**
 * Proses satu notifikasi WhatsApp dari primary device.
 * Reuse pipeline yang sama: extractOtp() + sendOtpEmail().
 */
export async function handleNotification(
  payload: NotificationPayload,
): Promise<IngestResult> {
  const { phone, title, text, packageName, postedAt } = payload;

  // Filter: hanya proses notifikasi dari WhatsApp
  if (packageName && !WHATSAPP_PACKAGES.includes(packageName)) {
    console.log(`⏭️  Ignored notif from ${packageName}`);
    return { status: 'ignored' };
  }

  const timestamp = new Date(postedAt ?? Date.now()).toLocaleString('id-ID');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📩 [Ingest] WhatsApp notification`);
  console.log(`   Phone      : ${phone}`);
  console.log(`   Title      : ${title ?? '-'}`);
  console.log(`   Text       : ${text}`);
  console.log(`   Timestamp  : ${timestamp}`);

  const otpResult = extractOtp(text);
  if (!otpResult) {
    console.log(`   ℹ️  No OTP pattern detected`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return { status: 'no_otp' };
  }

  const label = otpResult.type === 'link' ? 'OTP LINK' : 'OTP CODE';
  console.log(`   🔐 ${label} DETECTED: ${otpResult.value}`);
  console.log(`   📧 Sending OTP email...`);

  try {
    await sendOtpEmail({
      otp: otpResult.value,
      otpType: otpResult.type,
      senderPhone: title ?? 'Unknown',
      senderName: title ?? 'Unknown',
      receiverPhone: phone,
      messageBody: text,
      timestamp,
    });
    console.log(`   ✅ OTP email sent`);
  } catch (err: any) {
    console.error(`   ❌ Failed to send OTP email:`, err.message);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return { status: 'sent', otp: otpResult.value, otpType: otpResult.type };
}
