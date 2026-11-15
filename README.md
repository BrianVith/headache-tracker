# Headache Tracker (PWA)

A simple, installable web app to track daily headache check-ins.

- **3 daily slots:** Morning (08:00), Midday (13:00), Evening (19:00)
- **Question:** "Are you experiencing a headache?" (Yes / No)
- **Storage:** saved only on the device (browser storage), no account, no backend
- **Works offline** after install (PWA)

## Project status
v1 implements on-device logging and local statistics. Scheduled background notifications at exact times are **not guaranteed** for a static/no-backend PWA; for reliable prompts, set 3 daily alarms in the phone's Clock app to open the app.

## Local preview
This is a static site (no build step). Serve the folder over HTTP locally, for example:

```bash
cd /home/beve/aiproject/wife-app
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser.

> Note: Service workers/PWA install behavior is limited on plain localhost/HTTP in some contexts; full install testing is best done on the deployed HTTPS (GitHub Pages) URL from the target phone.

## Deploy to GitHub Pages (recommended)
1. Create a **new GitHub repository** under your account (e.g. `headache-tracker`). Do **not** reuse the `pokebulb` repo.
2. In this folder, initialize and push:
   ```bash
   cd /home/beve/aiproject/wife-app
   git init
   git add .
   git commit -m "Initial headache tracker PWA"
   git branch -M main
   git remote add origin git@github.com:<your-user>/headache-tracker.git
   git push -u origin main
   ```
3. In GitHub: **Settings → Pages** → set Source to **Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. Your site will be available at `https://<your-user>.github.io/headache-tracker/`.

All asset paths are relative (`./...`), so it works under the repository subpath.

## Install on Samsung Galaxy S24 FE (easy)
1. Open **Chrome** on the phone and go to the GitHub Pages URL.
2. Tap the menu (**⋮**) → **Add to Home screen** or **Install app** → confirm.
3. Open **Headache Tracker** from the home screen icon.
4. (Optional) Allow notifications if prompted. For reliable 3× daily prompts, also set phone Clock alarms for 08:00, 13:00, and 19:00 to open the app.

## Data & privacy
- Entries are stored locally on the device (`localStorage`).
- No data is sent to a server by the app.
- Clearing site/app data or uninstalling/removing browser storage can delete history.

## Files
- `index.html` – UI structure
- `styles.css` – styles
- `app.js` – app logic, storage, stats
- `manifest.webmanifest` – PWA manifest
- `sw.js` – service worker (offline caching)
- `icons/icon.svg` – app icon
