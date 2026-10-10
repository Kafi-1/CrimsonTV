# CrimsonTV

Modern, clean IPTV web app with enhanced player, mobile support and premium UI.

Inspired by classic IPTV apps but rebuilt with better UX.

---

## Features

### Core
- Firebase Authentication (Email + Google)
- Guest mode (skip login)
- M3U playlist loader
- HLS player (hls.js) with custom headers support
- Category tabs + Search
- Favorites (localStorage + Firestore sync)
- Recently Watched
- Remember last channel

### Player
- Fullscreen (Desktop + Mobile/iOS fallback)
- Play / Pause with live icon update
- Volume slider + Mute
- Channel Previous / Next
- Picture-in-Picture
- Share channel
- Keyboard shortcuts:
  - `Space` / `K` → Play/Pause
  - `F` → Fullscreen
  - `M` → Mute
  - `←` `→` → Previous / Next channel
  - `↑` `↓` → Volume

### UI / UX
- Black · White · Red modern dark theme
- Fully responsive (Desktop + Mobile)
- Mobile bottom navigation (Home / Favorites / Recent / Search)
- Touch-friendly favorite buttons
- Smooth controls auto-hide
- Big center play button when paused

### PWA Ready
- Web App Manifest included
- Add to Home Screen support

---

## Setup

### 1. Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project
3. Enable **Authentication** → Email/Password + Google
4. Create **Firestore** database
5. Open `js/firebase-config.js`
6. Paste your config

### 2. Firestore Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 3. M3U Link

Open `js/app.js` and change:

```js
const M3U_URL = 'YOUR_M3U_LINK_HERE';
```

### 4. Run

```bash
npx serve .
# or
python -m http.server 3000
```

> ES Modules + Firebase need a real server (`file://` will not work).

---

## File Structure

```
crimson-tv/
├── index.html
├── manifest.json
├── css/
│   └── style.css
├── js/
│   ├── firebase-config.js
│   ├── m3u-parser.js
│   └── app.js
└── README.md
```

---

## Notes

- CORS: Some M3U servers block browser requests. You may need a proxy (Cloudflare Worker etc.).
- Stream quality depends on the M3U source.
- For Google Sign-In add your domain in Firebase authorized domains.

---

## Changelog (from original Mehedi-TV)

**Fixes**
- Fullscreen now works (Desktop + iOS fallback)
- Mobile bottom navigation fully functional
- Play/Pause icon updates live
- Favorite buttons visible on touch devices
- Custom headers (User-Agent / Referer) applied to streams
- Better error handling
- Prevented double initApp calls

**New Features**
- Volume slider
- Channel Prev / Next
- Keyboard shortcuts
- Remember last channel
- Recently Watched
- Picture-in-Picture
- Share button
- Mobile search overlay
- Enhanced UI + new Black · White · Red theme
- PWA manifest
- Big center play button

---

Made with ❤️ for better live TV experience.
