# Setup redroid di Server Linux — Skala Multi-Nomor

Panduan menjalankan banyak instance WhatsApp (1 nomor = 1 container redroid)
di server Linux, masing-masing menjalankan Forwarder App yang mengirim OTP ke
satu Ingest Server.

> **Kenapa server Linux, bukan Windows?** redroid butuh modul kernel `binder`
> (dan `ashmem`/`memfd`). Kernel WSL2 Windows tidak menyertakannya, jadi redroid
> tidak jalan di Windows tanpa custom kernel. Di Linux native, modul ini tersedia.

---

## Arsitektur

```
┌─ Server Linux ─────────────────────────────────────────────┐
│                                                             │
│  redroid container #1 (port 5555) → WA nomor#1 + Forwarder ─┐
│  redroid container #2 (port 5556) → WA nomor#2 + Forwarder ─┤
│  redroid container #N (port 555x) → WA nomor#N + Forwarder ─┤
│                                                             │
│  Ingest Server (Node, port 3000) ←──────────────────────────┘
│    └─ extractOtp() + email                                  │
└─────────────────────────────────────────────────────────────┘
```

Tiap container = 1 Android terisolasi dengan storage sendiri (auth WA & config
Forwarder per nomor). Ingest server membedakan sumber via field `phone`.

---

## 0. Prasyarat server

- Linux dengan akses root (Ubuntu 22.04+ direkomendasikan).
- Docker terinstall.
- **KVM aktif** (`/dev/kvm` ada) untuk performa — cek: `ls /dev/kvm`.
- RAM cukup: ~1.5–2 GB per container aktif. 77 container = server besar
  (≥128 GB RAM) atau dipecah ke beberapa server (sharding).

---

## 1. Load modul kernel binder

redroid butuh binder. Di banyak distro perlu di-load manual:

```bash
# Cek apakah sudah ada
ls /dev/binder* 2>/dev/null

# Load (Ubuntu: paket linux-modules-extra biasanya menyediakannya)
sudo modprobe binder_linux devices="binder,hwbinder,vndbinder"
sudo modprobe ashmem_linux   # sebagian kernel; abaikan jika tidak ada

# Verifikasi
ls /dev/binder*
```

Jika `binder_linux` tidak ditemukan:
```bash
sudo apt-get update
sudo apt-get install -y linux-modules-extra-$(uname -r)
sudo modprobe binder_linux devices="binder,hwbinder,vndbinder"
```

Agar persistent setelah reboot, tambahkan ke `/etc/modules-load.d/`:
```bash
echo "binder_linux" | sudo tee /etc/modules-load.d/redroid.conf
echo "options binder_linux devices=binder,hwbinder,vndbinder" | sudo tee /etc/modprobe.d/redroid.conf
```

---

## 2. Jalankan 1 container redroid (prototype dulu)

```bash
docker pull redroid/redroid:13.0.0-latest

# Container untuk nomor pertama, expose adb di port 5555
docker run -itd --rm --privileged \
  --name redroid-1 \
  -v ~/redroid-data/1:/data \
  -p 5555:5555 \
  redroid/redroid:13.0.0-latest \
  androidboot.redroid_width=720 \
  androidboot.redroid_height=1280 \
  androidboot.redroid_dpi=320
```

- `-v ~/redroid-data/1:/data` → storage persisten per nomor (auth WA tersimpan).
- `--privileged` → akses binder. (Bisa diperketat dengan device mapping spesifik.)

Connect adb dari server:
```bash
adb connect localhost:5555
adb devices    # harus muncul localhost:5555  device
```

---

## 3. Install WhatsApp + Forwarder ke container

redroid **tidak punya Play Store**, jadi install via APK (sideload):

```bash
# WhatsApp Business APK (unduh dari sumber resmi/mirror tepercaya, cocokkan ABI x86_64)
adb -s localhost:5555 install whatsapp-business.apk

# Forwarder APK (hasil build Android Studio)
adb -s localhost:5555 install app-debug.apk
```

> Catatan ABI: redroid x86_64 butuh APK yang mendukung x86_64. WhatsApp APK
> resmi multi-ABI; jika hanya arm, aktifkan native bridge (image redroid
> `*-arm` translation) atau gunakan APK yang sesuai.

---

## 4. Login WhatsApp + konfigurasi Forwarder (per nomor)

Karena headless, kontrol UI lewat adb:

```bash
# Buka WhatsApp, lalu lakukan registrasi nomor (butuh OTP verifikasi via SMS
# ke nomor itu — siapkan akses SMS, mis. dari GSM modem pool).
adb -s localhost:5555 shell monkey -p com.whatsapp.w4b 1
```

Registrasi nomor & input OTP verifikasi paling praktis lewat **scrcpy**
(mirror layar container) sekali per nomor:
```bash
scrcpy -s localhost:5555
```

Set config Forwarder tanpa UI (tulis SharedPreferences via app, atau
sediakan endpoint config). Cara termudah saat ini: buka Forwarder via scrcpy,
isi Server URL / Nomor / Token, aktifkan Notification Access.

> **Notification Access via adb** (hindari klik manual):
> ```bash
> adb -s localhost:5555 shell settings put secure enabled_notification_listeners \
>   com.waotp.forwarder/com.waotp.forwarder.OtpNotificationListener
> adb -s localhost:5555 shell cmd notification allow_listener \
>   com.waotp.forwarder/com.waotp.forwarder.OtpNotificationListener
> ```

**Server URL di server Linux:** karena Ingest Server jalan di host yang sama,
gunakan IP host yang dijangkau container (mis. `http://172.17.0.1:3000/ingest`
— gateway docker bridge — atau IP LAN server). BUKAN `10.0.2.2` (itu khusus AVD).

---

## 5. Scale ke banyak nomor

Loop container, tiap nomor beda nama + port + volume:

```bash
for i in $(seq 1 10); do
  port=$((5554 + i))
  docker run -itd --rm --privileged \
    --name redroid-$i \
    -v ~/redroid-data/$i:/data \
    -p $port:5555 \
    redroid/redroid:13.0.0-latest \
    androidboot.redroid_width=720 androidboot.redroid_height=1280 androidboot.redroid_dpi=320
  adb connect localhost:$port
done
```

Lalu install APK + konfigurasi per container (otomatisasi dengan script:
install, set notification listener via adb, set config).

### Pertimbangan skala 77
1. **Sharding** — jangan satu server untuk 77. Pecah ke beberapa server
   (mis. 15–25 container/server) untuk batasi blast radius & resource.
2. **Resource** — ~1.5–2 GB RAM + 1–2 vCPU per container aktif.
3. **Risiko ban WhatsApp** — WA agresif mendeteksi emulator. Roll out bertahap,
   monitor per akun, jangan provision 77 sekaligus.
4. **Provisioning OTP registrasi** — tiap nomor butuh OTP verifikasi saat
   registrasi WA (via SMS). Siapkan sumber OTP SMS (GSM modem) → input ke
   container via scrcpy/adb.
5. **Persistensi** — volume `/data` per nomor wajib agar WA tidak minta
   re-login tiap restart container.
6. **Health monitoring** — pantau tiap container: WA masih login? Forwarder
   masih kirim? adb masih connect? Auto-restart bila perlu.

---

## 6. Yang TIDAK berubah dari prototype

- **Ingest Server** (`src/ingest-server.ts`) — identik. Sudah multi-nomor
  (bedakan via `phone`). 1 server menerima dari semua container.
- **Forwarder App** (`android-forwarder/`) — APK identik di semua container,
  hanya beda config (phone + server URL).
- **otp-extractor + mailer** — identik.

Yang berubah hanya: AVD → redroid container, dan `10.0.2.2` → IP host server.

---

## 7. Checklist verifikasi per container

```bash
adb -s localhost:<port> shell settings get secure enabled_notification_listeners   # ada com.waotp.forwarder
adb -s localhost:<port> logcat -d -s OtpForwarder:*                                 # lihat notif tertangkap + HTTP 200
# trigger OTP ke nomor → cek log Ingest Server: 🔐 OTP CODE DETECTED + ✅ email
```
