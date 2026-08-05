import 'dotenv/config';
import express from 'express';
import { handleNotification, type NotificationPayload } from './ingest/notification-handler.js';

/**
 * Ingest Server — menerima notifikasi OTP dari OTP Forwarder App
 * (Android NotificationListenerService) yang berjalan di emulator
 * tempat WhatsApp aktif sebagai PRIMARY device.
 *
 * Alur:
 *   Emulator (WA primary) → notif OTP → Forwarder App → POST /ingest → email
 *
 * Pipeline: validasi payload, extractOtp, lalu kirim email.
 */
function main() {
  const required = ['MAIL_HOST', 'MAIL_USERNAME', 'MAIL_PASSWORD', 'MAIL_TO'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('❌ Missing required env vars:', missing.join(', '));
    process.exit(1);
  }

  const app = express();
  app.use(express.json());

  // Shared-secret sederhana antara app & server. Set INGEST_TOKEN di .env.
  const INGEST_TOKEN = process.env.INGEST_TOKEN;

  app.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'wa-otp-ingest',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/ingest', async (req, res) => {
    if (INGEST_TOKEN) {
      const auth = req.header('x-ingest-token');
      if (auth !== INGEST_TOKEN) {
        return res.status(401).json({ error: 'invalid token' });
      }
    }

    const payload = req.body as NotificationPayload;
    if (!payload?.phone || !payload?.text) {
      return res.status(400).json({ error: 'phone and text are required' });
    }

    // ACK cepat, proses async (mirip pola webhook lama)
    res.json({ ok: true });

    try {
      await handleNotification(payload);
    } catch (err: any) {
      console.error('❌ Ingest processing error:', err.message);
    }
  });

  const PORT = parseInt(process.env.INGEST_PORT || '3000', 10);
  app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║       WhatsApp OTP Ingest Server - Started       ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`Ingest API : http://localhost:${PORT}/ingest`);
    console.log(`Health     : http://localhost:${PORT}/`);
    console.log(`Auth token : ${INGEST_TOKEN ? '[set]' : '[NONE — set INGEST_TOKEN di .env]'}`);
    console.log('\nContoh test (simulasi notif OTP Shopee):');
    console.log(`  curl -X POST http://localhost:${PORT}/ingest \\`);
    console.log(`       -H "Content-Type: application/json" \\`);
    if (INGEST_TOKEN) console.log(`       -H "x-ingest-token: <token>" \\`);
    console.log(`       -d '{"phone":"628xxx","title":"Shopee Security","text":"SHOPEE: Gunakan Kode OTP 217141 UNTUK DAFTAR AKUN SHOPEE","packageName":"com.whatsapp"}'`);
    console.log('');
  });
}

main();
