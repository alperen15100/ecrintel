# ECRINTEL Google Play Data Safety Draft

Status: pre-AdMob production baseline, 6 September 2026.

## Current Android build
- No user account required.
- No runtime permission for location, camera, microphone, contacts, files or phone data.
- Network permissions only: INTERNET and ACCESS_NETWORK_STATE.
- App content is loaded over HTTPS in Android WebView.
- External publisher/source links open outside the ECRINTEL WebView.
- No production advertising SDK is included in this baseline.

## Suggested Play Console answers for this baseline
Data collected by the developer directly through the Android app: none intentionally collected.
Data shared by the developer directly through the Android app: none intentionally shared.
Data encrypted in transit: yes, ECRINTEL traffic is HTTPS and clear-text traffic is disabled.
Account deletion: not applicable because the app does not provide user accounts.

## Important third-party note
Internet hosting providers and websites opened by the user can process standard connection information such as IP address, user-agent/device information and request timestamps under their own policies. Re-check the final Play declaration against every SDK and service present in the production AAB.

## AdMob gate
Do not submit this Data Safety declaration unchanged after enabling Google Mobile Ads. Before production AdMob is added, update this file and the Privacy Policy using the current Google Mobile Ads SDK data-disclosure documentation and the app's actual consent configuration.
