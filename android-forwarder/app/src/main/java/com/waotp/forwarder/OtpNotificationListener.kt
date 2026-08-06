package com.waotp.forwarder

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONObject
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Membaca notifikasi WhatsApp di PRIMARY device (emulator) dan
 * mem-forward isinya ke Ingest Server.
 *
 * WhatsApp memblokir OTP dari companion device, tapi notifikasi
 * di primary device tetap memuat teks OTP secara penuh.
 */
class OtpNotificationListener : NotificationListenerService() {

    private val executor = Executors.newSingleThreadExecutor()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg = sbn.packageName
        if (pkg !in ALLOWED_PACKAGES) return

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: ""

        if (text.isBlank()) return

        // Abaikan notifikasi non-pesan (mis. "Checking for new messages")
        if (title.isBlank() && text.startsWith("Checking")) return

        Log.d(TAG, "Notif from $pkg | $title | $text")
        forward(title, text, pkg, sbn.postTime)
    }

    private fun forward(title: String, text: String, pkg: String, postedAt: Long) {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", null) ?: return
        val phone = prefs.getString("phone", null) ?: return
        val token = prefs.getString("token", "") ?: ""

        executor.execute {
            try {
                val body = JSONObject().apply {
                    put("phone", phone)
                    put("title", title)
                    put("text", text)
                    put("packageName", pkg)
                    put("postedAt", postedAt)
                }.toString()

                val conn = (URL(serverUrl).openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    connectTimeout = 10000
                    readTimeout = 10000
                    setRequestProperty("Content-Type", "application/json")
                    if (token.isNotBlank()) setRequestProperty("x-ingest-token", token)
                }

                conn.outputStream.use { os: OutputStream ->
                    os.write(body.toByteArray(Charsets.UTF_8))
                }

                val code = conn.responseCode
                Log.d(TAG, "Forwarded → HTTP $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Forward failed: ${e.message}")
            }
        }
    }

    companion object {
        private const val TAG = "OtpForwarder"
        const val PREFS = "otp_forwarder_prefs"
        val ALLOWED_PACKAGES = setOf(
            // WHATSAPP
            "com.whatsapp", 
            "com.whatsapp.w4b",

            // SMS -> Tambah packages baru jika package dibawah tidak mengcover tipe HP lainnya
            "com.android.mms",
            "com.google.android.apps.messaging",  
            "com.samsung.android.messaging"
        )
    }
}