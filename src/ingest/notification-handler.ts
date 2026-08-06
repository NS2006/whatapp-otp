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

const TARGET_PACKAGES = [
  // --- WhatsApp ---
  'com.whatsapp', 
  'com.whatsapp.w4b',
  
  // --- SMS --- Tambah package lain jika package dibawah tidak mengcover tipe HP lainnya
  'com.android.mms',
  'com.google.android.apps.messaging',  
  'com.samsung.android.messaging'
];

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


  // DEBUG -> Print notif yang masuk dari POST request
  console.log(`\nDEBUG: Received notification from Package: ${packageName}`);
  console.log(`Text: ${text}`);

  // Filter: hanya proses notifikasi dari WhatsApp dan SMS
  if (packageName && !TARGET_PACKAGES.includes(packageName)) {
    console.log(`⏭️  Ignored notif from ${packageName}`);
    return { status: 'ignored' };
  }

  const timestamp = new Date(postedAt ?? Date.now()).toLocaleString('id-ID');


  // Print data notifikasi yang masuk ke termina
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if(packageName?.startsWith("com.whatsapp")){  
    console.log(`📩 [Ingest] WhatsApp notification`);
  } else{
    console.log(`📩 [Ingest] SMS notification`);
  }

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

  const otpFrom = packageName?.startsWith("com.whatsapp") ? "Whatsapp" : "SMS"

  const label = otpResult.type === 'link' ? 'OTP LINK' : 'OTP CODE';
  console.log(`   🔐 ${label} DETECTED FROM ${otpFrom}: ${otpResult.value}`);
  console.log(`   📧 Sending OTP email...`);

  try {
    await sendOtpEmail({
      otp: otpResult.value,
      otpType: otpResult.type,
      otpFrom: otpFrom,
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
