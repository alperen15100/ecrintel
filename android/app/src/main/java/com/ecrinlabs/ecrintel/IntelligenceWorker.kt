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
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

class IntelligenceWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
    companion object { const val CHANNEL_ID="ecrintel_intelligence"; private const val INTEL_URL="https://raw.githubusercontent.com/alperen15100/ecrintel/main/data/intel.json" }
    override suspend fun doWork(): Result = try {
        ensureChannel()
        val prefs=applicationContext.getSharedPreferences("ecrintel_native",Context.MODE_PRIVATE)
        if(!prefs.getBoolean("critical_alerts",false)) return Result.success()
        val events=JSONObject(get(INTEL_URL)).optJSONArray("events")?:return Result.success()
        val watch=parseWatch(prefs.getString("watch_assets","[]"))
        val last=prefs.getLong("last_critical_time",0L)
        var newest:JSONObject?=null;var newestTime=last;var newestHits=emptyList<String>()
        for(i in 0 until events.length()){
            val e=events.optJSONObject(i)?:continue
            if(e.optInt("severity",0)<8)continue
            val t=parseTime(e.optString("time"));if(t<=last)continue
            val hits=linkedAssets(e.optString("title","")).filter{watch.contains(it)}
            if(watch.isNotEmpty()&&hits.isEmpty())continue
            if(t>newestTime){newest=e;newestTime=t;newestHits=hits}
        }
        if(newest!=null&&newestTime>last){
            val label=if(newestHits.isNotEmpty())newestHits.joinToString(" · ") else "HIGH IMPACT"
            notifyCritical("ECRINTEL · $label","${newest!!.optString("title","High-impact intelligence")}\n${newest!!.optString("source","Source")} · ${newest!!.optString("region","Global")}")
            prefs.edit().putLong("last_critical_time",newestTime).apply()
        }
        Result.success()
    } catch(_:Exception){Result.retry()}
    private fun parseWatch(raw:String?):Set<String>{return try{val a=JSONArray(raw?:"[]");buildSet{for(i in 0 until a.length())add(a.optString(i).uppercase())}}catch(_:Exception){emptySet()}}
    private fun linkedAssets(title:String):Set<String>{val t=title.lowercase();val out=linkedSetOf<String>();if(Regex("oil|opec|tanker|hormuz|refinery|pipeline|brent").containsMatchIn(t))out.add("BRENT");if(Regex("war|missile|attack|geopolit|inflation|crisis").containsMatchIn(t))out.add("GOLD");if(Regex("fed|rates|inflation|jobs|payroll|tariff").containsMatchIn(t)){out.add("SPX");out.add("NDX");out.add("DXY")};if(Regex("bitcoin|crypto").containsMatchIn(t)){out.add("BTC");out.add("ETH")};if(Regex("ecb|euro").containsMatchIn(t))out.add("EURUSD");return out}
    private fun parseTime(s:String):Long=try{Instant.parse(s).toEpochMilli()}catch(_:Exception){0L}
    private fun get(url:String):String{val c=URL(url).openConnection() as HttpURLConnection;c.connectTimeout=12000;c.readTimeout=12000;c.requestMethod="GET";c.setRequestProperty("User-Agent","ECRINTEL-Mobile/1.9");return try{if(c.responseCode !in 200..299)throw IllegalStateException("HTTP ${c.responseCode}");c.inputStream.bufferedReader().use{it.readText()}}finally{c.disconnect()}}
    private fun ensureChannel(){if(Build.VERSION.SDK_INT>=26){val c=NotificationChannel(CHANNEL_ID,"ECRINTEL Intelligence",NotificationManager.IMPORTANCE_HIGH).apply{description="High-impact intelligence for followed markets"};applicationContext.getSystemService(NotificationManager::class.java).createNotificationChannel(c)}}
    private fun notifyCritical(title:String,body:String){if(Build.VERSION.SDK_INT>=33&&ActivityCompat.checkSelfPermission(applicationContext,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;val n=NotificationCompat.Builder(applicationContext,CHANNEL_ID).setSmallIcon(R.drawable.ic_notification).setContentTitle(title.take(80)).setContentText(body.take(180)).setStyle(NotificationCompat.BigTextStyle().bigText(body.take(500))).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).build();NotificationManagerCompat.from(applicationContext).notify((System.currentTimeMillis()%100000).toInt(),n)}
}
