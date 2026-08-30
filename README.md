# ECRINTEL — ULTIMATE FINAL
Global-first market intelligence terminal by Ecrin Labs.

Includes:
- Key-free OpenStreetMap + USGS + NASA EONET
- Geopolitics, macro, energy and shipping intelligence
- Source de-duplication / multi-source grouping
- Global markets: BTC, ETH, Gold, Brent, WTI, S&P 500, Nasdaq, DXY, EUR/USD, Nikkei, DAX, FTSE, Hang Seng
- Why Is It Moving? evidence view (no fake attribution percentages)
- Event → market sensitivity engine with transparent keyword rules
- Intelligence search
- Local watchlist and browser notification support
- Macro schedule radar
- Event detail + source link
- PWA-ready premium mobile interface
- Single 15-minute GitHub Actions data engine

BIST module intentionally excluded from this build.

Notes:
Impact values are heuristic sensitivity indicators, never return forecasts.
Why Is It Moving shows relevant evidence, not claimed causality.
Browser notifications on a static PWA can alert while the app/site is active; true closed-app Android push requires a native/push backend later.


Data Fix 202: focused multi-query GEO/MACRO/ENERGY feed, official BLS calendar + published FOMC/ECB/BoE/BoJ dates, and mobile calendar layout fix.

Frontend intel loader now uses resilient local/raw fallback and isolates map-marker failures. BLS 403 dependency removed; published official 2026 BLS schedule snapshot is used.

Intel Load Fix 204: browser now fetches both Pages-local and GitHub RAW intel snapshots and selects the non-empty/freshest payload, eliminating placeholder/stale Pages races.

Region Fix 205:
- Null/unknown intel coordinates are no longer coerced to 0,0.
- Unknown-location stories now display GLOBAL instead of AFRICA.
- Unknown-location stories are no longer plotted in the Gulf of Guinea.
- Real geocoded stories continue to use their existing region/map placement.

Region Classifier 206:
- Headline/entity classification now has priority over ambiguous coordinates.
- Fed/FOMC/US -> Americas.
- BoE/UK/England/ECB/Eurozone/Spain/Cyprus/Ukraine/Kyiv -> Europe.
- BOJ/Japan/Yen/South Korea/China/West Asia -> Asia.
- Iran/Hormuz/Yemen/Israel/Gulf -> Middle East.
- Africa is assigned only when African entities/coordinates actually match.

Region Hard Fix 207:
- Region classification is now generated server-side into data/intel.json.
- Frontend trusts explicit region first, then falls back to its own classifier.
- Unknown stories remain GLOBAL; AFRICA is never a default.
- Requires one ECRINTEL data engine run after deploy to populate region fields.

Intelligence Suite 208:
- Breaking Intelligence banner
- Asset Intelligence dossiers
- Event/asset intelligence timeline
- Source verification / source-density view
- PWA offline shell via service worker
