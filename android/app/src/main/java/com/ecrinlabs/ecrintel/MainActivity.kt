package com.ecrinlabs.ecrintel

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {

    private lateinit var map: MapView
    private lateinit var statusText: TextView
    private lateinit var filterRow: LinearLayout
    private lateinit var eventCard: LinearLayout
    private lateinit var eventMeta: TextView
    private lateinit var eventTitle: TextView
    private lateinit var eventSource: TextView

    private val events = mutableListOf<IntelEvent>()
    private var activeFilter = "ALL"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Configuration.getInstance().userAgentValue = packageName
        setContentView(R.layout.activity_main)

        map = findViewById(R.id.map)
        statusText = findViewById(R.id.statusText)
        filterRow = findViewById(R.id.filterRow)
        eventCard = findViewById(R.id.eventCard)
        eventMeta = findViewById(R.id.eventMeta)
        eventTitle = findViewById(R.id.eventTitle)
        eventSource = findViewById(R.id.eventSource)

        map.setTileSource(TileSourceFactory.MAPNIK)
        map.setMultiTouchControls(true)
        map.controller.setZoom(3.0)
        map.controller.setCenter(GeoPoint(20.0, 10.0))

        listOf("ALL", "GEOPOLITICS", "ENERGY", "MACRO").forEach { addFilterButton(it) }
        loadIntel()
    }

    private fun addFilterButton(label: String) {
        val button = Button(this).apply {
            text = label
            isAllCaps = false
            setTextColor(Color.WHITE)
            textSize = 11f
            setBackgroundColor(if (label == activeFilter) Color.rgb(48, 64, 33) else Color.rgb(20, 24, 28))
            setPadding(22, 4, 22, 4)
            setOnClickListener {
                activeFilter = label
                refreshFilterButtons()
                renderMarkers()
            }
        }
        val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, 86)
        params.marginEnd = 10
        filterRow.addView(button, params)
    }

    private fun refreshFilterButtons() {
        for (i in 0 until filterRow.childCount) {
            val b = filterRow.getChildAt(i) as Button
            b.setBackgroundColor(if (b.text.toString() == activeFilter) Color.rgb(48, 64, 33) else Color.rgb(20, 24, 28))
        }
    }

    private fun loadIntel() {
        statusText.text = "GLOBAL MARKET INTELLIGENCE · LOADING"
        thread {
            try {
                val url = URL("https://raw.githubusercontent.com/alperen15100/ecrintel/main/data/intel.json")
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 12000
                connection.readTimeout = 12000
                connection.requestMethod = "GET"
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                val root = JSONObject(body)
                val array = root.getJSONArray("events")
                val loaded = mutableListOf<IntelEvent>()
                for (i in 0 until array.length()) {
                    val o = array.getJSONObject(i)
                    if (o.isNull("lat") || o.isNull("lon")) continue
                    val lat = o.optDouble("lat", Double.NaN)
                    val lon = o.optDouble("lon", Double.NaN)
                    if (lat.isNaN() || lon.isNaN()) continue
                    loaded += IntelEvent(
                        category = o.optString("category", "unknown"),
                        title = o.optString("title", "Untitled intelligence signal"),
                        source = o.optString("source", "Unknown source"),
                        url = o.optString("url", ""),
                        time = o.optString("time", ""),
                        severity = o.optInt("severity", 0),
                        region = o.optString("region", "GLOBAL"),
                        lat = lat,
                        lon = lon
                    )
                }
                runOnUiThread {
                    events.clear()
                    events.addAll(loaded)
                    statusText.text = "GLOBAL MARKET INTELLIGENCE · ${events.size} MAPPED SIGNALS"
                    renderMarkers()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    statusText.text = "GLOBAL MARKET INTELLIGENCE · DATA UNAVAILABLE"
                }
            }
        }
    }

    private fun renderMarkers() {
        map.overlays.removeAll { it is Marker }
        val visible = events.filter {
            activeFilter == "ALL" || it.category.equals(activeFilter, ignoreCase = true)
        }

        visible.forEach { event ->
            val marker = Marker(map).apply {
                position = GeoPoint(event.lat, event.lon)
                setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                title = event.title
                snippet = "${event.category.uppercase()} · ${event.region} · SEV ${event.severity}"
                setOnMarkerClickListener { _, _ ->
                    showEvent(event)
                    map.controller.animateTo(position)
                    true
                }
            }
            map.overlays.add(marker)
        }
        map.invalidate()
    }

    private fun showEvent(event: IntelEvent) {
        eventCard.visibility = View.VISIBLE
        eventMeta.text = "${event.category.uppercase()} · ${event.region} · SEV ${event.severity}"
        eventTitle.text = event.title
        eventSource.text = "${event.source}  •  ${event.time.replace("T", " ").replace("Z", " UTC")}" 
        eventCard.setOnClickListener {
            if (event.url.isNotBlank()) startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(event.url)))
        }
    }

    override fun onResume() {
        super.onResume()
        map.onResume()
    }

    override fun onPause() {
        map.onPause()
        super.onPause()
    }

    data class IntelEvent(
        val category: String,
        val title: String,
        val source: String,
        val url: String,
        val time: String,
        val severity: Int,
        val region: String,
        val lat: Double,
        val lon: Double
    )
}
