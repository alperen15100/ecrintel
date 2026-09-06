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

class IntelligenceWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    companion object { const val CHANNEL_ID="ecrintel_intelligence"; private const val INTEL_URL="https://raw.githubusercontent.com/alperen15100/ecrintel/main/data/intel.json" }
    override suspend fun doWork(): Result = try {
        ensureChannel(); val prefs=applicationContext.getSharedPreferences("ecrintel_native",Context.MODE_PRIVATE); val events=JSONObject(get(INTEL_URL)).optJSONArray("events")
        if(events!=null){for(i in 0 until events.length()){val e=events.optJSONObject(i)?:continue; if(e.optInt("severity",0)>=8){val id=e.optString("id"); val seen=prefs.getString("last_critical_id",null); if(id.isNotBlank()&&id!=seen&&prefs.getBoolean("critical_alerts",true)){notifyCritical(e.optString("title","Critical intelligence"),"${e.optString("source","Source")} · ${e.optString("region","Global")}");prefs.edit().putString("last_critical_id",id).apply()};break}}}
        Result.success()
    } catch(_:Exception){Result.retry()}
    private fun get(url:String):String{val c=URL(url).openConnection() as HttpURLConnection;c.connectTimeout=12000;c.readTimeout=12000;c.requestMethod="GET";c.setRequestProperty("User-Agent","ECRINTEL-Mobile/1.3");return try{if(c.responseCode !in 200..299)throw IllegalStateException("HTTP ${c.responseCode}");c.inputStream.bufferedReader().use{it.readText()}}finally{c.disconnect()}}
    private fun ensureChannel(){if(Build.VERSION.SDK_INT>=26){val c=NotificationChannel(CHANNEL_ID,"ECRINTEL Intelligence",NotificationManager.IMPORTANCE_HIGH).apply{description="Critical and watchlist-linked market intelligence"};applicationContext.getSystemService(NotificationManager::class.java).createNotificationChannel(c)}}
    private fun notifyCritical(title:String,body:String){if(Build.VERSION.SDK_INT>=33&&ActivityCompat.checkSelfPermission(applicationContext,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;val n=NotificationCompat.Builder(applicationContext,CHANNEL_ID).setSmallIcon(R.drawable.ic_notification).setContentTitle(title.take(80)).setContentText(body.take(180)).setStyle(NotificationCompat.BigTextStyle().bigText(body.take(500))).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).build();NotificationManagerCompat.from(applicationContext).notify((System.currentTimeMillis()%100000).toInt(),n)}
}
