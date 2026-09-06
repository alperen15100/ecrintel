package com.ecrinlabs.ecrintel

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class IntelligenceWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    companion object {
        const val CHANNEL_ID = "ecrintel_intelligence"
        private const val INTEL_URL = "https://raw.githubusercontent.com/alperen15100/ecrintel/main/data/intel.json"
        private const val MARKETS_URL = "https://raw.githubusercontent.com/alperen15100/ecrintel/main/data/markets.json"
    }

    override suspend fun doWork(): Result {
        return try {
            ensureChannel()
            val prefs = applicationContext.getSharedPreferences("ecrintel_native", Context.MODE_PRIVATE)
            val intel = JSONObject(get(INTEL_URL))
            val events = intel.optJSONArray("events")
            var topTitle = prefs.getString("widget_headline", "Monitoring global intelligence") ?: "Monitoring global intelligence"

            if (events != null) {
                var newestCriticalId: String? = null
                for (i in 0 until events.length()) {
                    val e = events.optJSONObject(i) ?: continue
                    val severity = e.optInt("severity", 0)
                    if (i == 0) topTitle = e.optString("title", topTitle)
                    if (severity >= 8 && newestCriticalId == null) {
                        newestCriticalId = e.optString("id")
                        val seen = prefs.getString("last_critical_id", null)
                        if (!newestCriticalId.isNullOrBlank() && newestCriticalId != seen && prefs.getBoolean("critical_alerts", true)) {
                            notifyCritical(
                                e.optString("title", "Critical intelligence"),
                                "${e.optString("source", "Source")} · ${e.optString("region", "Global")}"
                            )
                            prefs.edit().putString("last_critical_id", newestCriticalId).apply()
                        }
                    }
                }
            }

            val markets = JSONObject(get(MARKETS_URL)).optJSONArray("markets")
            val wanted = setOf("BTC", "GOLD", "BRENT", "S&P500")
            val snapshot = mutableListOf<String>()
            if (markets != null) {
                for (i in 0 until markets.length()) {
                    val m = markets.optJSONObject(i) ?: continue
                    val symbol = m.optString("symbol")
                    if (symbol in wanted) snapshot += "$symbol ${m.optString("priceDisplay", "—")}" 
                }
            }

            prefs.edit()
                .putString("widget_markets", snapshot.joinToString("  ·  "))
                .putString("widget_headline", topTitle)
                .apply()
            EcrintelWidget.updateAll(applicationContext)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    private fun get(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 12_000
        c.readTimeout = 12_000
        c.requestMethod = "GET"
        c.setRequestProperty("User-Agent", "ECRINTEL-Android/1.2")
        return try {
            if (c.responseCode !in 200..299) throw IllegalStateException("HTTP ${c.responseCode}")
            c.inputStream.bufferedReader().use { it.readText() }
        } finally {
            c.disconnect()
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "ECRINTEL Intelligence",
                NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "Critical and watchlist-linked market intelligence" }
            applicationContext.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun notifyCritical(title: String, body: String) {
        if (Build.VERSION.SDK_INT >= 33 && ActivityCompat.checkSelfPermission(
                applicationContext,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) return

        val n = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title.take(80))
            .setContentText(body.take(180))
            .setStyle(NotificationCompat.BigTextStyle().bigText(body.take(500)))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        NotificationManagerCompat.from(applicationContext)
            .notify((System.currentTimeMillis() % 100000).toInt(), n)
    }
}
