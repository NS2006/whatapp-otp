package com.waotp.forwarder

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Layar konfigurasi: set Server URL, Nomor, Token, lalu buka
 * pengaturan Notification Access agar listener bisa jalan.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val prefs = getSharedPreferences(OtpNotificationListener.PREFS, MODE_PRIVATE)

        val urlInput = findViewById<EditText>(R.id.serverUrl)
        val phoneInput = findViewById<EditText>(R.id.phone)
        val tokenInput = findViewById<EditText>(R.id.token)

        urlInput.setText(prefs.getString("server_url", "http://10.0.2.2:3000/ingest"))
        phoneInput.setText(prefs.getString("phone", ""))
        tokenInput.setText(prefs.getString("token", ""))

        findViewById<Button>(R.id.save).setOnClickListener {
            prefs.edit()
                .putString("server_url", urlInput.text.toString().trim())
                .putString("phone", phoneInput.text.toString().trim())
                .putString("token", tokenInput.text.toString().trim())
                .apply()
            Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.grantAccess).setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }
}
