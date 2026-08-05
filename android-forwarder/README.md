# WA OTP Forwarder (Android)

Aplikasi Android yang membaca notifikasi WhatsApp pada primary device dan
meneruskan isinya ke Ingest Server.

## Persyaratan

- Android 7.0 (API 24) atau lebih baru.
- WhatsApp atau WhatsApp Business terpasang dan notifikasinya aktif.
- HP dapat mengakses Ingest Server melalui jaringan.
- JDK 17 atau lebih baru untuk build (JDK 21 sudah teruji).

## Build APK

```powershell
cd android-forwarder
$env:JAVA_HOME='C:\Program Files\Java\jdk-21'
.\gradlew.bat assembleDebug
```

APK hasil build: `app/build/outputs/apk/debug/app-debug.apk`.

## Instalasi di HP fisik

Aktifkan USB debugging, sambungkan HP, lalu jalankan:

```powershell
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

APK juga dapat disalin ke HP dan dibuka langsung. Android mungkin meminta izin
untuk memasang aplikasi dari sumber tersebut.

Setelah aplikasi dibuka:

1. Isi **Server URL** dengan alamat yang dapat dijangkau HP, misalnya
   `https://otp.example.com/ingest` atau `http://192.168.1.10:3000/ingest`.
   Jangan gunakan `10.0.2.2` pada HP fisik; alamat itu hanya untuk emulator AVD.
2. Isi **Nomor** dengan nomor WhatsApp pada HP, misalnya `6285965885649`.
3. Isi **Token** dengan nilai `INGEST_TOKEN` yang sama seperti di server.
4. Tekan **Simpan**.
5. Tekan **Beri Izin Notification Access**, lalu aktifkan WA OTP Forwarder.
6. Pastikan notifikasi WhatsApp diizinkan dan tidak disembunyikan oleh mode hemat
   baterai atau pengaturan background vendor HP.

## Pengujian

Kirim OTP uji ke nomor WhatsApp tersebut. Pastikan notifikasi muncul, kemudian
periksa log Ingest Server untuk pesan `OTP CODE DETECTED` dan `OTP email sent`.

## Catatan keamanan

Gunakan HTTPS jika server diakses melalui internet. APK mengizinkan HTTP untuk
pengujian jaringan lokal, sehingga token dan isi OTP tidak terenkripsi apabila
Server URL menggunakan `http://`.
