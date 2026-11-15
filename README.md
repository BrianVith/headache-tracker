# Headache Tracker (PWA + Android APK)

A simple headache tracker app.

- **3 daily slots:** Morning (08:00), Midday (13:00), Evening (19:00)
- **Question:** "Are you experiencing a headache?" (Yes / No)
- **Storage:** saved only on the device (local storage), no account, no backend
- **Statistics:** local history and summaries
- **Android app (Capacitor):** supports on-device scheduled local reminders at 08:00/13:00/19:00; tapping a reminder opens the matching check-in

## Project layout
- `index.html`, `styles.css`, `app.js` – web app UI/logic
- `manifest.webmanifest`, `sw.js`, `icons/` – PWA assets
- `capacitor.config.json`, `package.json` – Capacitor/Android app configuration (`webDir: "www"`)
- `www/` – web assets copied for Capacitor (keep in sync with root web files before `cap sync`)
- `android/` – generated native Android project (created by `cap add android`)

Data remains local on-device in both web and Android app usage.

## Web/PWA preview (optional)
Static site, no build step required:

```bash
cd /home/beve/aiproject/wife-app
python3 -m http.server 8080
# open http://localhost:8080
```

The browser/PWA version cannot guarantee exact-time background reminders. For reliable reminders, use the Android app build below.

## Build Android APK (one-time assisted install)

### Prerequisites
- Node.js + npm
- Android Studio (with Android SDK / platform tools) and JDK

### 1) Install dependencies and add/sync Android platform
```bash
cd /home/beve/aiproject/wife-app
npm install
# android/ is already included if you pulled this repo state; otherwise:
# npx cap add android
npm run cap:sync
```
(Use your Linux/WSL Node+npm. `cap:sync` copies web files to `www/` and runs `npx cap sync android`.)

### 2) Open in Android Studio and build APK
```bash
npx cap open android
```
In Android Studio:
- Let Gradle sync complete
- **Build → Build Bundle(s) / APK(s) → Build APK(s)** (debug APK is fine for one-time assisted install)
- APK output is typically under `android/app/build/outputs/apk/debug/`

After any web file changes (`index.html`, `app.js`, `styles.css`, etc.), run:
```bash
npm run cap:sync
```
(or copy updated files into `www/` and run `npx cap sync android`) then rebuild the APK.

### 3) Install on Samsung Galaxy S24 FE (assisted)
1. Transfer the APK to the phone (USB, file share, etc.).
2. Open/install it and allow **Install unknown apps** for the installer app if prompted (one-time).
3. Open **Headache Tracker**, allow **Notifications** when prompted.
4. Confirm reminders are scheduled (About & reminders → Enable daily reminders). Test by temporarily changing device time or using test scheduling if needed, then restore.

Tapping a reminder should open the app directly to that slot’s Yes/No question.

## Deploy web version to GitHub Pages (optional)
The web version can still be hosted on GitHub Pages:
1. Push to your repo (e.g. `BrianVith/headache-tracker`)
2. GitHub **Settings → Pages** → Source: **Deploy from a branch**, Branch: `main`, Folder: `/ (root)`

Relative paths are used so it works under `/<repo>/`.

## Notes
- Clearing app/site data or uninstalling removes locally stored history.
- Exact alarm/reminder behavior can be affected by Android battery optimization settings; if reminders are delayed, exempt the app from aggressive battery optimization on the device.
- This project is separate from `/home/beve/aiproject/ai` (`pokebulb`).
- If `npx cap ...` fails in WSL with `cap: Permission denied` or Windows `CMD.EXE` UNC path errors, use a Linux Node/npm (e.g. nvm) from `/home/beve/aiproject/wife-app`, or run `node ./node_modules/@capacitor/cli/bin/capacitor <command>`.
