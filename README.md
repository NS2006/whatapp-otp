# WhatsApp OTP Receiver

Menangkap OTP WhatsApp yang masuk ke nomor-nomor seller, mengekstrak kode/link OTP-nya,
lalu meneruskan ke email.

## Latar belakang & arsitektur

WhatsApp hanya menampilkan pesan OTP tertentu secara lengkap di **primary device**.
Karena itu, aplikasi ini memakai satu jalur saja: membaca notifikasi WhatsApp pada
perangkat Android utama dan meneruskannya ke ingest server.

Solusinya: jadikan device yang kita kontrol (Android emulator) sebagai **primary
device** untuk tiap nomor, lalu baca OTP dari **notifikasi** device itu.

```
┌─ Android emulator (primary device) ─────────┐
│  WhatsApp (nomor OTP, login sebagai primary) │
│  + WA OTP Forwarder (app Android)            │
│     └─ NotificationListenerService           │
│         baca notif OTP → POST /ingest ────────┼──▶ Ingest Server (Node, repo ini)
└──────────────────────────────────────────────┘      └─ extractOtp() + email
```

- **Ingest Server** (`src/ingest-server.ts`) — Node/Express, repo ini. Terima notif
  OTP via `POST /ingest`, jalankan `extractOtp` + kirim email.
- **WA OTP Forwarder** (`android-forwarder/`) — APK Android, baca notif WhatsApp di
  emulator, forward ke ingest server. Lihat `android-forwarder/README.md`.

## Quick Start (Ingest Server)

```bash
npm install
cp .env.example .env   # isi MAIL_* dan MAIL_TO minimal
npm run dev            # ingest server di http://localhost:3000
```

Test pipeline tanpa emulator (simulasi notif OTP Shopee):

```bash
curl -X POST http://localhost:3000/ingest \
     -H "Content-Type: application/json" \
     -d '{"phone":"628xxx","title":"Shopee Security","text":"SHOPEE: Gunakan Kode OTP 217141 UNTUK DAFTAR AKUN SHOPEE","packageName":"com.whatsapp"}'
```

Console akan menampilkan `🔐 OTP CODE DETECTED: 217141` + `✅ OTP email sent`.

## Setup Forwarder App

Lihat [android-forwarder/README.md](android-forwarder/README.md) — build APK,
install ke emulator, set Server URL / Nomor / Token, beri izin Notification Access.

## Scale ke banyak nomor (produksi)

1 nomor = 1 emulator (Android tidak bisa 2 nomor WA aktif dalam 1 instance).
Untuk skala (mis. 77 nomor) gunakan **redroid** (Android di Docker) di server
Linux — app & ingest server **tidak berubah**, hanya emulatornya.

Lihat [docs/redroid-server-setup.md](docs/redroid-server-setup.md).

## File Structure

```
wa-otp-receiver/
├── src/
│   ├── ingest-server.ts          # Entry point — ingest server (npm run dev)
│   ├── ingest/
│   │   └── notification-handler.ts  # Terima notif → extractOtp → email
│   ├── otp-extractor.ts          # Pattern matching OTP (kode angka & link)
│   └── mailer.ts                 # Kirim email notifikasi OTP
├── android-forwarder/            # APK Android notification listener
├── .env.example
└── package.json
```

## Env vars (ingest)

| Var | Fungsi |
|---|---|
| `INGEST_PORT` | Port server (default 3000) |
| `INGEST_TOKEN` | Shared secret dgn app (opsional) |
| `MAIL_*`, `MAIL_TO`, `MAIL_CC` | Konfigurasi email |
