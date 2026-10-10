# CrimsonTV v2

ক্লিন ডার্ক UI-এর IPTV ওয়েব অ্যাপ — মোবাইল ও ডেস্কটপ দুটোতেই রেসপনসিভ।
Developer: Abdullah Al Kafi — https://kafi.dev.bd

## পেজ
Live (Home) · Favorites · History · Search · Settings · Support · FAQ · Developer Info

## প্লেয়ার
- Quality selector (Auto/720p/480p…), Fit/Fill/Stretch, গিয়ার মেনু
- Double-tap বাম/ডান = আগের/পরের চ্যানেল, মাঝে = fullscreen
- Fullscreen + landscape lock + iOS fallback, PiP, Share, Wake Lock, Media Session
- Auto-reconnect ও error recovery, buffering loader
- শর্টকাট: Space/K, F, M, ← →, ↑ ↓

## বিজ্ঞাপন
প্রতিটি বিজ্ঞাপন আলাদা iframe-এ লোড হয় (atOptions conflict নেই), 728x90 ব্যানার ছোট স্ক্রিনে অটো-স্কেল হয়।
স্লট: Live পেজে ২টি (banner + native), Settings পেজে ১টি। কনফিগ: `js/app.js` → `ADS`

## সেটআপ
1. `js/firebase-config.js` এ Firebase config বসান (Login/Favorites sync-এর জন্য; না দিলে guest mode কাজ করবে)
2. `js/app.js` এর `M3U_URL` এ প্লেলিস্ট লিংক দিন
3. Firestore rules-এ `users/{uid}` ছাড়াও Support ফর্মের জন্য চাইলে `support_messages` এ create allow করুন:
```
match /support_messages/{id} { allow create: if true; allow read: if false; }
```
4. GitHub Pages / যেকোনো static host-এ আপলোড করুন (file:// এ চলবে না)।
