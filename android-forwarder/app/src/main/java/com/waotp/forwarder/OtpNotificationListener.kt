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

        val channelId = sbn.notification.channelId.orEmpty()
        // simSlot = 0 -> Sim Card Pertama
        // simSlot = 1 -> Sim Card Kedua
        val simSlot = Regex("slot(\\d+)", RegexOption.IGNORE_CASE)
            .find(channelId)
            ?.groupValues
            ?.get(1)
            ?.toIntOrNull()

        Log.d(TAG, "Channel = $channelId")
        Log.d(TAG, "SIM Slot = $simSlot")

        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()
            ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()
            ?: ""

        if (text.isBlank()) return
        if (title.isBlank() && text.startsWith("Checking")) return

        forward(title, text, pkg, sbn.postTime, simSlot)
    }

    private fun forward(title: String, text: String, pkg: String, postedAt: Long, simSlot: Int?) {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val serverUrl = prefs.getString("server_url", null) ?: return
        
        // Ambil data
        val phone1 = prefs.getString("phone1", "") ?: ""
        val phone2 = prefs.getString("phone2", "") ?: ""
        val waType1 = prefs.getString("wa_type1", "none") ?: "none"
        val waType2 = prefs.getString("wa_type2", "none") ?: "none"
        val token = prefs.getString("token", "") ?: ""


        var matchedPhone = phone1 // Default nya SIM 1

        if (pkg == "com.whatsapp") {
            // Cek nomor mana yang WA biasa
            if (waType1 == "personal") matchedPhone = phone1
            else if (waType2 == "personal") matchedPhone = phone2
        } else if (pkg == "com.whatsapp.w4b") {
            // Cek nomor mana yang WA Business
            if (waType1 == "business") matchedPhone = phone1
            else if (waType2 == "business") matchedPhone = phone2
        } else {
            // Cek nomor mana yang dapat SMS berdasarkan SIM Slot
            if (simSlot == 1) {
                matchedPhone = phone2
            } else {
                matchedPhone = phone1
            }
        }

        if (matchedPhone.isBlank()) {
            matchedPhone = phone1
        }

        executor.execute {
            try {
                val body = JSONObject().apply {
                    put("phone", matchedPhone)
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
                Log.d(TAG, "Forwarded → HTTP $code | Phone: $matchedPhone")
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