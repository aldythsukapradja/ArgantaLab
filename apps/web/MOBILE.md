# ArgantaLab — Native (Android + iOS) via Capacitor

The web app (`dist/`) is wrapped in a native WebView shell. No code is forked — the
same React build runs on web, Android, and iOS. Native plugins are web-shimmed, so
`initNative()` (in `src/lib/native.ts`) is a no-op in the browser and only does work
on a real device.

- **App ID:** `com.argantalab.app`
- **App name:** ArgantaLab
- **Web dir:** `dist` (Vite build output)
- **Config:** `capacitor.config.ts`

## One-time prerequisites

- **Android:** Android Studio (Giraffe+), JDK 17, an SDK + emulator or a device.
- **iOS (Mac only):** Xcode 15+, CocoaPods (`sudo gem install cocoapods`).

## Day-to-day commands (run in `apps/web`)

```bash
npm run mobile     # build web + copy into android/ + ios/
npm run android    # build + sync + open Android Studio
npm run ios        # build + sync + open Xcode  (Mac only)
```

Under the hood each runs `npm run build` then `cap sync`. Always re-run after
changing web code — the native projects hold a *copy* of `dist/`.

## Android — build & run

1. `npm run android` (opens Android Studio on the `android/` project).
2. Pick a device/emulator → Run ▶. Or from CLI: `cd android && ./gradlew assembleDebug`.
3. Release APK/AAB: set up a signing key, then `./gradlew bundleRelease`.

## iOS — build & run (Mac required)

The `ios/` folder scaffolds on Windows, but pods + builds only work on a Mac.

1. On the Mac, in `apps/web`: `npm install` then `npm run ios`.
   (First run does `pod install` automatically via `cap sync`.)
2. In Xcode: select the **App** target → set your Signing Team → Run ▶.

## What the native shell adds

- **Splash screen** (`#6d28d9`) hidden once React mounts.
- **Status bar** auto-themes (light/dark) and re-themes when the app theme flips.
- **Android back button** → goes to the Play home; if already there, minimises the
  app instead of hard-exiting.
- **Safe-area insets** — topbar/dock respect notches & home indicators
  (`viewport-fit=cover` + `env(safe-area-inset-*)`).

## Notes

- `android/` and `ios/` each carry their own `.gitignore` from `cap add`.
- Supabase calls work unchanged — Capacitor serves from a localhost origin, so the
  existing client config is fine. No CORS/base-path changes needed.
