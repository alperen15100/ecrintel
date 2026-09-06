package com.ecrinlabs.ecrintel

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class EcrintelWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { updateOne(context, appWidgetManager, it) }
    }

    companion object {
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, EcrintelWidget::class.java)
            manager.getAppWidgetIds(component).forEach { updateOne(context, manager, it) }
        }

        private fun updateOne(context: Context, manager: AppWidgetManager, id: Int) {
            val prefs = context.getSharedPreferences("ecrintel_native", Context.MODE_PRIVATE)
            val markets = prefs.getString("widget_markets", "BTC —  ·  GOLD —") ?: "BTC —  ·  GOLD —"
            val headline = prefs.getString("widget_headline", "Monitoring global intelligence") ?: "Monitoring global intelligence"
            val views = RemoteViews(context.packageName, R.layout.widget_ecrintel)
            views.setTextViewText(R.id.widgetMarkets, markets)
            views.setTextViewText(R.id.widgetHeadline, headline)
            val intent = Intent(context, MainActivity::class.java)
            val pi = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
            views.setOnClickPendingIntent(R.id.widgetRoot, pi)
            manager.updateAppWidget(id, views)
        }
    }
}
