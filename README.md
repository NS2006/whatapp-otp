# WhatsApp OTP Receiver

Menangkap OTP WhatsApp yang masuk ke nomor-nomor seller, mengekstrak kode/link OTP-nya,
lalu meneruskan ke email.

## Latar belakang & arsitektur

WhatsApp hanya menampilkan pesan OTP tertentu secara lengkap di **primary device**.
Karena itu, aplikasi ini memakai satu jalur saja: membaca notifikasi WhatsApp pada
perangkat Android utama dan meneruskannya ke ingest server.

Solusinya: jadikan HP atau emulator Android yang kita kontrol sebagai **primary
device**, lalu baca OTP dari **notifikasi** device itu.

```
┌─ Android device (primary device) ──────────┐
│  WhatsApp (nomor OTP, login sebagai primary) │
│  + WA OTP Forwarder (app Android)            │
│     └─ NotificationListenerService           │
│         baca notif OTP → POST /ingest ────────┼──▶ Ingest Server (Node, repo ini)
└──────────────────────────────────────────────┘      └─ extractOtp() + email
```

- **Ingest Server** (`src/ingest-server.ts`) — Node/Express, repo ini. Terima notif
  OTP via `POST /ingest`, jalankan `extractOtp` + kirim email.
- **WA OTP Forwarder** (`android-forwarder/`) — APK Android, baca notif WhatsApp di
  HP atau emulator, lalu forward ke ingest server.

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

Persyaratan build:

- JDK 17 atau lebih baru; JDK 21 sudah teruji.
- Android SDK Platform 34 dan Android SDK Build Tools.
- Android 7.0 (API 24) atau lebih baru untuk perangkat tujuan.

Build APK debug dari PowerShell:

```powershell
cd android-forwarder
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
java -version

# Pastikan local.properties menunjuk ke Android SDK komputer ini.
.\gradlew.bat clean assembleDebug
.\gradlew.bat lintDebug
```

APK akan dibuat di:

```text
android-forwarder/app/build/outputs/apk/debug/app-debug.apk
```

Install ke HP yang sudah mengaktifkan USB debugging:

```powershell
adb devices
adb install -r app\build\outputs\apk\debug\app-debug.apk
```

Setelah aplikasi terpasang:

1. Isi **Server URL** dengan alamat yang dapat diakses HP, misalnya
   `https://otp.example.com/ingest` atau `http://192.168.1.10:3000/ingest`.
2. Jangan gunakan `10.0.2.2` pada HP fisik; alamat tersebut hanya untuk emulator AVD.
3. Isi **Nomor** WhatsApp dan **Token** yang sama dengan `INGEST_TOKEN` server.
4. Tekan **Simpan**.
5. Tekan **Beri Izin Notification Access**, lalu aktifkan WA OTP Forwarder.
6. Pastikan notifikasi WhatsApp dan aktivitas background tidak diblokir.

Panduan lebih lengkap tersedia di
[android-forwarder/README.md](android-forwarder/README.md).

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
