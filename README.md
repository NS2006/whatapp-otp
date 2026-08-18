# OTP Receiver (Android App)

Aplikasi Android (Notification Listener) yang bertugas menangkap notifikasi OTP (dari WhatsApp, WhatsApp Business, maupun SMS) yang masuk ke perangkat, lalu meneruskannya ke Ingest Server terpusat.

## Latar belakang & arsitektur

WhatsApp dan SMS hanya menampilkan pesan OTP tertentu secara lengkap di **primary device**.
Karena itu, aplikasi ini memakai satu jalur saja: membaca notifikasi WhatsApp pada
perangkat Android utama dan meneruskannya ke ingest server.

Solusinya: jadikan HP atau emulator Android yang kita kontrol sebagai **primary
device**, lalu baca OTP dari **notifikasi** device itu.

```
┌─ Android device (primary device) ──────────┐
│  WhatsApp / SMS                            │
│  + WA OTP Forwarder (app Android)          │
│    └─ NotificationListenerService          │
│        baca notif OTP → POST /ingest ──────┼──▶ OTP Webportal (Repo Terpisah)
└──────────────────────────────────────────────┘      └─ Simpan DB & Kirim Email Massal
```
- Repository [https://github.com/NS2006/otp-webportal](OTP Web Portal)

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

1. Buka aplikasi.
2. Isi Server URL dengan alamat endpoint Ingest Server Anda.
    - Berkat konfigurasi Network Security, Anda dapat dengan aman menggunakan HTTP untuk testing di jaringan lokal (misalnya [http://192.168.1.10:3000/ingest](http://192.168.1.10:3000/ingest)) maupun HTTPS untuk server produksi ([https://otp.example.com/ingest](https://otp.example.com/ingest)).

    - Catatan: Jangan gunakan 10.0.2.2 pada HP fisik; alamat tersebut khusus agar emulator AVD bisa mengakses localhost komputer Anda.

3. Isi **Nomor WhatsApp** dan **Token** (pastikan token sama persis dengan `INGEST_TOKEN` yang ada di .env server).
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
whatapp-otp/
├── android-forwarder/            # APK Android notification listener project
│   ├── app/                      # Main application module
│   │   ├── src/main/             
│   │   │   ├── java/             # Source code (MainActivity, OtpNotificationListener)
│   │   │   ├── res/              # UI resources (layouts, strings, network security config)
│   │   │   └── AndroidManifest.xml # App configuration and system permissions
│   │   └── build.gradle          # App-level Gradle build script
├── docs/                         # Additional documentation (e.g., redroid-server-setup)
```
