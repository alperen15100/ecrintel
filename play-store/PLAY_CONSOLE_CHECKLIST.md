# ECRINTEL — Google Play submission checklist (2026)

## App identity
- App: ECRINTEL: Market Intelligence
- Package: com.ecrinlabs.ecrintel
- Developer brand: Ecrin Labs
- Category: Finance
- Purpose: source-based global market, geopolitical, macro, energy and natural-event intelligence.
- No brokerage, exchange, wallet, deposits, loans, order execution or guaranteed-return functionality.
- Market sensitivity and event correlations are informational and are not price forecasts or personalized investment advice.

## Technical
- Target/compile SDK: API 36 (Android 16).
- HTTPS only; cleartext traffic disabled.
- INTERNET and ACCESS_NETWORK_STATE only, plus POST_NOTIFICATIONS for user-enabled intelligence alerts.
- Notification permission must be requested in context and alerts must remain optional.
- Production release must be signed and uploaded as AAB.
- Test final release on current Android and at least one older supported Android version.

## Privacy / User data
- Public privacy-policy URL required in Play Console and accessible from the app.
- Keep Data safety answers consistent with actual app + website + every third-party SDK.
- Current design has no account/login, contacts, precise location, photos/media upload or native analytics/ads SDK.
- Local watchlist, language and alert preferences remain device-local unless architecture changes.
- Network providers and linked sources may receive normal connection metadata such as IP address/user agent.
- If AdMob, analytics, crash reporting, login, cloud sync or another SDK is added, re-audit Data safety and privacy policy before release.

## Financial features declaration
- Complete the declaration in Play Console for every release/app.
- ECRINTEL is informational market intelligence; do not claim brokerage, exchange, wallet or portfolio-management functionality unless actually added.
- Because the app discusses markets/investing, review the exact Play Console choices at submission time and select the truthful category presented by Google (including Other/support service if applicable).
- Never describe ECRINTEL as executing trades or providing personalized financial advice when it does not.

## Store content
- Complete Content rating questionnaire truthfully.
- Complete Ads declaration truthfully (currently no ads SDK; change if AdMob is added).
- Complete App access: no login required.
- Complete Target audience and content.
- Add privacy policy URL.
- Provide support/contact details that are actually monitored.
- Upload 512x512 icon, 1024x500 feature graphic, phone screenshots and localized listings.
- Avoid claims such as guaranteed profit, guaranteed accuracy, buy/sell signals, risk-free, or predictive certainty.

## 26 localization targets
English, Turkish, German, French, Spanish, Portuguese, Italian, Dutch, Polish, Russian, Ukrainian, Arabic, Persian, Hebrew, Simplified Chinese, Traditional Chinese, Japanese, Korean, Hindi, Indonesian, Vietnamese, Thai, Malay, Greek, Romanian, Swedish.

## Before production
1. Verify every visible feature works in the final APK/AAB.
2. Verify external source links open outside the WebView where intended.
3. Verify notification opt-in/denial paths.
4. Verify no synthetic/fake confidence percentages.
5. Verify privacy policy matches the final binary and website.
6. Re-run Google Play policy review immediately before submission because policies can change.
