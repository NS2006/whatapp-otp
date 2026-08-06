package com.waotp.forwarder

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.RadioGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

/**
 * Layar konfigurasi: set Server URL, Nomor SIM 1 & 2, Opsi WA, Token,
 * lalu buka pengaturan Notification Access agar listener bisa jalan.
 */
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val prefs = getSharedPreferences(OtpNotificationListener.PREFS, MODE_PRIVATE)

        val urlInput = findViewById<EditText>(R.id.serverUrl)
        val phone1Input = findViewById<EditText>(R.id.phone1)
        val waGroup1 = findViewById<RadioGroup>(R.id.waGroup1)
        val phone2Input = findViewById<EditText>(R.id.phone2)
        val waGroup2 = findViewById<RadioGroup>(R.id.waGroup2)
        val tokenInput = findViewById<EditText>(R.id.token)

        urlInput.setText(prefs.getString("server_url", ""))
        phone1Input.setText(prefs.getString("phone1", ""))
        phone2Input.setText(prefs.getString("phone2", ""))
        tokenInput.setText(prefs.getString("token", ""))

        setWaRadioSelection(waGroup1, prefs.getString("wa_type1", "none"), isSim1 = true)
        setWaRadioSelection(waGroup2, prefs.getString("wa_type2", "none"), isSim1 = false)

        findViewById<Button>(R.id.save).setOnClickListener {
            val waType1 = getWaRadioValue(waGroup1)
            val waType2 = getWaRadioValue(waGroup2)

            if (waType1 != "none" && waType1 == waType2) {
                val errorMsg = if (waType1 == "personal") {
                    "Error: Kedua SIM tidak bisa diset ke WA Biasa secara bersamaan."
                } else {
                    "Error: Kedua SIM tidak bisa diset ke WA Business secara bersamaan."
                }
                Toast.makeText(this, errorMsg, Toast.LENGTH_LONG).show()
                
                return@setOnClickListener
            }

            prefs.edit()
                .putString("server_url", urlInput.text.toString().trim())
                .putString("phone1", phone1Input.text.toString().trim())
                .putString("wa_type1", waType1)
                .putString("phone2", phone2Input.text.toString().trim())
                .putString("wa_type2", waType2)
                .putString("token", tokenInput.text.toString().trim())
                .apply()

            Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.grantAccess).setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }

    private fun setWaRadioSelection(group: RadioGroup, value: String?, isSim1: Boolean) {
        if (isSim1) {
            when (value) {
                "personal" -> group.check(R.id.waPersonal1)
                "business" -> group.check(R.id.waBiz1)
                else -> group.check(R.id.waNone1)
            }
        } else {
            when (value) {
                "personal" -> group.check(R.id.waPersonal2)
                "business" -> group.check(R.id.waBiz2)
                else -> group.check(R.id.waNone2)
            }
        }
    }

    private fun getWaRadioValue(group: RadioGroup): String {
        return when (group.checkedRadioButtonId) {
            R.id.waPersonal1, R.id.waPersonal2 -> "personal"
            R.id.waBiz1, R.id.waBiz2 -> "business"
            else -> "none"
        }
    }
}