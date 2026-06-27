# KinetikCircle — Android & iOS (Capacitor)

The web app is wrapped with **Capacitor 8**. `appId: com.argantalab.kinetikcircle`,
`appName: KinetikCircle`, `webDir: dist`. The native projects (`android/`, `ios/`) are
committed; their build outputs are gitignored.

## Build / run

```bash
cd apps/kinetik

# Android (needs Android Studio + SDK)
npm run cap:android      # build web → sync → opens Android Studio
#   then Run ▶, or Build > Generate Signed Bundle/APK

# iOS (needs a Mac with Xcode + CocoaPods)
npm run cap:ios          # build web → sync → opens Xcode
#   then Run ▶ on a simulator/device

# after any web change, re-copy assets into the native shells:
npm run cap:sync
```

## Still to do for a real store build

1. **Google sign-in (OAuth) in the native shell.** Supabase OAuth redirects to a web URL;
   inside a native WebView that must come back via a deep link. Steps:
   - install `@capacitor/app` + `@capacitor/browser`,
   - add redirect URL `com.argantalab.kinetikcircle://auth` in Supabase → Auth → URL config,
   - open the OAuth URL with `Browser.open`, and on `App.addListener('appUrlOpen', …)`
     call `supabase.auth.exchangeCodeForSession`.
   (Email/anon flows work as-is; only the Google redirect needs this.)
2. **App icon + splash**: `npx @capacitor/assets generate` from a 1024² source (reuse
   `public/icon.svg` rasterised) → writes Android/iOS icons + splash.
3. **Status bar / safe areas**: the UI already uses `env(safe-area-inset-*)`; optionally add
   `@capacitor/status-bar` to tint the bar per theme.
4. Bump `version` in `package.json` and set the Android `versionCode` / iOS build number.
