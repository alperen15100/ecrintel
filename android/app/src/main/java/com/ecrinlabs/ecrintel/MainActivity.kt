package com.ecrinlabs.ecrintel

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var progress: ProgressBar
    private lateinit var startupPanel: View
    private lateinit var errorPanel: View
    private lateinit var errorText: TextView
    private lateinit var retryButton: Button
    private val contentUrl = "https://alperen15100.github.io/ecrintel/"
    private val contentHost = "alperen15100.github.io"
    private val channelId = "ecrintel_intelligence"
    private val translators = ConcurrentHashMap<String, Translator>()
    private var readyFallback: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(7,16,25)
        window.navigationBarColor = Color.rgb(7,16,25)
        setContentView(R.layout.activity_main)
        webView=findViewById(R.id.webView);progress=findViewById(R.id.progress);startupPanel=findViewById(R.id.startupPanel)
        errorPanel=findViewById(R.id.errorPanel);errorText=findViewById(R.id.errorText);retryButton=findViewById(R.id.retryButton)
        createNotificationChannel();scheduleBackgroundIntel();configureWebView()
        retryButton.setOnClickListener{errorPanel.visibility=View.GONE;startupPanel.visibility=View.VISIBLE;webView.visibility=View.INVISIBLE;webView.reload()}
        onBackPressedDispatcher.addCallback(this,object:OnBackPressedCallback(true){override fun handleOnBackPressed(){if(webView.canGoBack())webView.goBack() else finish()}})
        if(savedInstanceState==null)webView.loadUrl(contentUrl) else webView.restoreState(savedInstanceState)
    }

    private fun showApp(){readyFallback?.let{webView.removeCallbacks(it)};readyFallback=null;webView.alpha=0f;webView.visibility=View.VISIBLE;webView.animate().alpha(1f).setDuration(180).start();startupPanel.visibility=View.GONE}

    private fun configureWebView(){
        with(webView.settings){javaScriptEnabled=true;domStorageEnabled=true;databaseEnabled=true;cacheMode=WebSettings.LOAD_DEFAULT;mixedContentMode=WebSettings.MIXED_CONTENT_NEVER_ALLOW;mediaPlaybackRequiresUserGesture=false;builtInZoomControls=false;displayZoomControls=false;useWideViewPort=true;loadWithOverviewMode=false;setSupportZoom(false);userAgentString="$userAgentString ECRINTEL-Mobile/1.5"}
        webView.setBackgroundColor(Color.rgb(7,16,25));webView.overScrollMode=View.OVER_SCROLL_NEVER;webView.addJavascriptInterface(AndroidBridge(),"EcrintelAndroid")
        webView.webChromeClient=object:WebChromeClient(){override fun onProgressChanged(view:WebView?,newProgress:Int){progress.progress=newProgress}}
        webView.webViewClient=object:WebViewClient(){
            override fun shouldOverrideUrlLoading(view:WebView?,request:WebResourceRequest?):Boolean{val uri=request?.url?:return false;val internal=uri.scheme=="https"&&uri.host==contentHost&&uri.path?.startsWith("/ecrintel")==true;if(internal)return false;return try{startActivity(Intent(Intent.ACTION_VIEW,uri));true}catch(_:Exception){false}}
            override fun onPageStarted(view:WebView?,url:String?,favicon:android.graphics.Bitmap?){readyFallback?.let{webView.removeCallbacks(it)};errorPanel.visibility=View.GONE;startupPanel.visibility=View.VISIBLE;webView.visibility=View.INVISIBLE}
            override fun onPageFinished(view:WebView?,url:String?){progress.progress=100;if(url?.startsWith(contentUrl)==true)injectPremiumUi()}
            override fun onReceivedError(view:WebView?,request:WebResourceRequest?,error:WebResourceError?){if(request?.isForMainFrame==true){startupPanel.visibility=View.GONE;errorText.text="ECRINTEL couldn't connect. Check your internet connection and try again.";errorPanel.visibility=View.VISIBLE}}
        }
    }

    private fun injectPremiumUi(){
        try{val css=assets.open("ecrintel-premium-v3.css").bufferedReader().use{it.readText()};val js=assets.open("ecrintel-premium-v3.js").bufferedReader().use{it.readText()};val cssScript="(function(){var o=document.getElementById('ecrintel-premium-css');if(o)o.remove();var s=document.createElement('style');s.id='ecrintel-premium-css';s.textContent=${JSONObject.quote(css)};document.head.appendChild(s);})();";webView.evaluateJavascript(cssScript){webView.evaluateJavascript(js,null)};readyFallback=Runnable{showApp()};webView.postDelayed(readyFallback!!,8000)}catch(_:Exception){showApp()}
    }

    private fun scheduleBackgroundIntel(){val constraints=Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();val req=PeriodicWorkRequestBuilder<IntelligenceWorker>(15,TimeUnit.MINUTES).setConstraints(constraints).build();WorkManager.getInstance(this).enqueueUniquePeriodicWork("ecrintel_background_intelligence",ExistingPeriodicWorkPolicy.UPDATE,req)}

    inner class AndroidBridge{
        @JavascriptInterface fun uiReady(){runOnUiThread{showApp()}}
        @JavascriptInterface fun requestNotifications(){runOnUiThread{if(Build.VERSION.SDK_INT>=33&&ActivityCompat.checkSelfPermission(this@MainActivity,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)ActivityCompat.requestPermissions(this@MainActivity,arrayOf(Manifest.permission.POST_NOTIFICATIONS),700)}}
        @JavascriptInterface fun notify(title:String,body:String){runOnUiThread{if(ActivityCompat.checkSelfPermission(this@MainActivity,Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED||Build.VERSION.SDK_INT<33){val n=NotificationCompat.Builder(this@MainActivity,channelId).setSmallIcon(R.drawable.ic_notification).setContentTitle(title.take(80)).setContentText(body.take(180)).setStyle(NotificationCompat.BigTextStyle().bigText(body.take(500))).setPriority(NotificationCompat.PRIORITY_HIGH).build();NotificationManagerCompat.from(this@MainActivity).notify((System.currentTimeMillis()%100000).toInt(),n)}}}
        @JavascriptInterface fun share(title:String,text:String){runOnUiThread{val i=Intent(Intent.ACTION_SEND).apply{type="text/plain";putExtra(Intent.EXTRA_SUBJECT,title);putExtra(Intent.EXTRA_TEXT,text)};startActivity(Intent.createChooser(i,"ECRINTEL"))}}
        @JavascriptInterface fun translate(requestId:String,targetTag:String,text:String){if(text.isBlank()){resolveTranslation(requestId,text,null);return};val normalized=if(targetTag.startsWith("zh"))"zh" else targetTag.lowercase();if(normalized=="en"){resolveTranslation(requestId,text,null);return};val target=TranslateLanguage.fromLanguageTag(normalized);if(target==null){resolveTranslation(requestId,text,"Unsupported language");return};val translator=translators.getOrPut(normalized){Translation.getClient(TranslatorOptions.Builder().setSourceLanguage(TranslateLanguage.ENGLISH).setTargetLanguage(target).build())};translator.downloadModelIfNeeded().onSuccessTask{translator.translate(text)}.addOnSuccessListener{resolveTranslation(requestId,it,null)}.addOnFailureListener{resolveTranslation(requestId,text,it.message?:"Translation failed")}}
    }
    private fun resolveTranslation(requestId:String,text:String,error:String?){runOnUiThread{if(!::webView.isInitialized)return@runOnUiThread;webView.evaluateJavascript("window.EcrintelI18nResolve&&window.EcrintelI18nResolve(${JSONObject.quote(requestId)},${JSONObject.quote(text)},${if(error==null)"null" else JSONObject.quote(error)});",null)}}
    private fun createNotificationChannel(){if(Build.VERSION.SDK_INT>=26){val c=NotificationChannel(channelId,"ECRINTEL Intelligence",NotificationManager.IMPORTANCE_HIGH).apply{description="Critical and watchlist-linked market intelligence"};getSystemService(NotificationManager::class.java).createNotificationChannel(c)}}
    override fun onSaveInstanceState(outState:Bundle){webView.saveState(outState);super.onSaveInstanceState(outState)}
    override fun onDestroy(){readyFallback?.let{webView.removeCallbacks(it)};translators.values.forEach{it.close()};translators.clear();webView.stopLoading();webView.webChromeClient=null;webView.loadUrl("about:blank");webView.clearHistory();webView.removeAllViews();webView.destroy();super.onDestroy()}
}
