/* ═══════════════════════════════════════════════════
   CrimsonTV v2 — Main Application
═══════════════════════════════════════════════════ */
import { loadM3U } from './m3u-parser.js';

/* ───────────── CONFIG ───────────── */
const M3U_URL = 'https://raw.githubusercontent.com/ahan443/FAST-IPTV/refs/heads/main/premium121.m3u';
const DEV_URL = 'https://kafi.dev.bd';
const PAGE_SIZE = 150;

const ADS = {
  banner: { key: '7e9627f51376c6e4560f12209f0e099f', w: 728, h: 90 },
  native: { src: 'https://pl31756762.profitableratecpmnetwork.com/0cd45fb864f5b70ccb28b69d91843ea3/invoke.js',
            id: 'container-0cd45fb864f5b70ccb28b69d91843ea3' }
};

const PAGES = [
  { id: 'home',      label: 'Live',      icon: 'fa-video',            bottom: true },
  { id: 'fav',       label: 'Favorites', icon: 'fa-heart',            bottom: true },
  { id: 'history',   label: 'History',   icon: 'fa-clock-rotate-left',bottom: true },
  { id: 'search',    label: 'Search',    icon: 'fa-magnifying-glass', bottom: true },
  { id: 'settings',  label: 'Settings',  icon: 'fa-gear',             bottom: true },
  { id: 'support',   label: 'Support',   icon: 'fa-headset' },
  { id: 'faq',       label: 'FAQ',       icon: 'fa-circle-question' },
  { id: 'developer', label: 'Developer', icon: 'fa-code' }
];

const FAQS = [
  ['চ্যানেল চলছে না, কী করব?', 'প্রথমে Retry চাপুন, তারপর অন্য চ্যানেল চেষ্টা করুন। অনেক ফ্রি স্ট্রিম সার্ভার সাময়িক বন্ধ থাকে বা নির্দিষ্ট দেশ থেকে ব্লক থাকে। সমস্যা চলতে থাকলে Support পেজে জানান।'],
  ['ভিডিও বারবার বাফার করছে', 'গিয়ার আইকন থেকে Quality কমিয়ে Low বা 480p/360p নিন, অথবা Settings-এ Default quality "Low" করুন। ইন্টারনেট স্পিডও চেক করুন।'],
  ['লগইন ছাড়া কি ব্যবহার করা যাবে?', 'হ্যাঁ। লগইন ছাড়াই সব চ্যানেল দেখা যায়। লগইন করলে আপনার Favorites অন্য ডিভাইসেও সিঙ্ক হয়।'],
  ['ফেভারিট কীভাবে যোগ করব?', 'যেকোনো চ্যানেল কার্ডের কোণায় হার্ট আইকনে ট্যাপ করুন। Favorites পেজে সব দেখতে পাবেন।'],
  ['ফুলস্ক্রিন বা ল্যান্ডস্কেপ কীভাবে হবে?', 'প্লেয়ারের ডানদিকের expand আইকন চাপুন। সাপোর্টেড ফোনে স্ক্রিন নিজে থেকে ল্যান্ডস্কেপ হবে। ডেস্কটপে F কী চাপলেও হয়।'],
  ['কীবোর্ড শর্টকাট কী কী?', 'Space/K = Play/Pause, F = Fullscreen, M = Mute, ← → = আগের/পরের চ্যানেল, ↑ ↓ = ভলিউম।'],
  ['এই অ্যাপে বিজ্ঞাপন কেন?', 'অ্যাপটি ফ্রি রাখার খরচ চালাতে সীমিত বিজ্ঞাপন দেখানো হয়। বিজ্ঞাপনে সমস্যা হলে Support পেজে জানান।'],
  ['চ্যানেলগুলো কোথা থেকে আসে?', 'চ্যানেলগুলো তৃতীয় পক্ষের পাবলিক M3U প্লেলিস্ট থেকে লোড হয়। CrimsonTV কোনো ভিডিও হোস্ট করে না এবং কনটেন্টের মালিক নয়।'],
  ['ডেভেলপারের সাথে কীভাবে যোগাযোগ করব?', 'Developer Info পেজ বা ' + DEV_URL + ' ওয়েবসাইটে যান।']
];

/* ───────────── STATE ───────────── */
const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
let channels = [];
let currentChannel = null;
let currentUser = null;
let fb = null;                       // firebase module bundle (optional)
let favorites = store.get('ctv_favs', []);
let recent = store.get('ctv_recent', []);
let settings = Object.assign({ autoplay: true, quality: 'auto', fit: 'contain', grid: 'm' }, store.get('ctv_settings', {}));
let activeCategory = 'All';
let searchQuery = '';
let currentPage = 'home';
let shown = PAGE_SIZE;
let hls = null;
let hlsRetry = 0;
let mediaRetry = 0;

const video = $('video');
const vWrap = $('vWrap');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idxOf = url => channels.findIndex(c => c.url === url);

/* ───────────── TOAST ───────────── */
let toastTimer;
function toast(msg){
  const t = $('playerToast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ───────────── NAVIGATION ───────────── */
function buildNav(){
  $('sideNav').innerHTML = PAGES.map(p =>
    `<button class="nav-item" data-page="${p.id}"><i class="fa-solid ${p.icon}"></i><span>${p.label}</span></button>`).join('');
  $('bottomNav').innerHTML = PAGES.filter(p => p.bottom).map(p =>
    `<button class="bn-item" data-page="${p.id}"><i class="fa-solid ${p.icon}"></i><span>${p.label}</span></button>`).join('');
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
}

function go(page, replace){
  if(!PAGES.some(p => p.id === page)) page = 'home';
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  if(location.hash !== '#' + page){
    if(replace) history.replaceState(null, '', '#' + page); else location.hash = page;
  }
  $('content').scrollTop = 0;
  if(page === 'fav') renderFav();
  if(page === 'history') renderHistory();
  if(page === 'search'){ renderSearch(); if(matchMedia('(min-width:1024px)').matches === false) setTimeout(() => $('pageSearchInput').focus(), 50); }
  mountAdsForPage(page);
  if(page !== 'home') closeGear();
}
window.addEventListener('hashchange', () => {
  const p = location.hash.slice(1) || 'home';
  if(p !== currentPage) go(p, true);
});

/* ───────────── FIREBASE (optional, never blocks the app) ───────────── */
async function initFirebase(){
  try{
    fb = await import('./firebase-config.js');
    fb.onAuthStateChanged(fb.auth, async user => {
      currentUser = user;
      if(user){
        $('authOverlay').classList.add('hidden');
        try{
          const snap = await fb.getDoc(fb.doc(fb.db, 'users', user.uid));
          if(snap.exists() && Array.isArray(snap.data().favorites)){
            favorites = Array.from(new Set([...snap.data().favorites, ...favorites]));
            store.set('ctv_favs', favorites);
            refreshLists();
          }
        }catch(e){}
      }
      updateUserUI();
    });
  }catch(e){
    console.warn('Firebase unavailable — guest mode only', e);
    fb = null;
  }
}

function showAuthError(msg){ const el = $('authError'); el.textContent = msg; el.classList.add('show'); }
function switchAuthTab(tab){
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  $('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  $('authError').classList.remove('show');
}
const cleanErr = e => (e && e.message ? e.message.replace('Firebase: ', '') : 'Something went wrong');

async function handleLogin(e){
  e.preventDefault();
  if(!fb) return showAuthError('Login এখন কাজ করছে না (Firebase সংযোগ নেই)।');
  const btn = $('loginBtn'); btn.disabled = true; btn.textContent = 'Signing in...';
  try{ await fb.signInWithEmailAndPassword(fb.auth, $('loginEmail').value.trim(), $('loginPass').value); }
  catch(err){ showAuthError(cleanErr(err)); }
  btn.disabled = false; btn.textContent = 'Sign In';
}
async function handleRegister(e){
  e.preventDefault();
  if(!fb) return showAuthError('Register এখন কাজ করছে না (Firebase সংযোগ নেই)।');
  const name = $('regName').value.trim(), email = $('regEmail').value.trim(), pass = $('regPass').value;
  if(pass.length < 6) return showAuthError('Password must be at least 6 characters');
  const btn = $('regBtn'); btn.disabled = true; btn.textContent = 'Creating...';
  try{
    const cred = await fb.createUserWithEmailAndPassword(fb.auth, email, pass);
    if(name) await fb.updateProfile(cred.user, { displayName: name });
    await fb.setDoc(fb.doc(fb.db, 'users', cred.user.uid), { name: name || email.split('@')[0], email, favorites, createdAt: new Date().toISOString() });
  }catch(err){ showAuthError(cleanErr(err)); }
  btn.disabled = false; btn.textContent = 'Create Account';
}
async function handleGoogle(){
  if(!fb) return showAuthError('Google login এখন কাজ করছে না (Firebase সংযোগ নেই)।');
  try{
    const r = await fb.signInWithPopup(fb.auth, fb.googleProvider);
    const ref = fb.doc(fb.db, 'users', r.user.uid);
    const snap = await fb.getDoc(ref);
    if(!snap.exists()) await fb.setDoc(ref, { name: r.user.displayName || 'User', email: r.user.email, favorites, createdAt: new Date().toISOString() });
  }catch(err){ showAuthError(cleanErr(err)); }
}
async function handleLogout(){
  try{ await fb?.signOut(fb.auth); }catch(e){}
  currentUser = null; updateUserUI(); toast('Signed out');
}
function updateUserUI(){
  const ua = $('userArea');
  if(!currentUser){
    ua.innerHTML = `<button class="signin-btn" id="signinBtn">Sign In</button>`;
    $('signinBtn').addEventListener('click', () => $('authOverlay').classList.remove('hidden'));
    return;
  }
  const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
  ua.innerHTML = `<div class="avatar" title="${esc(name)}">${esc(name.charAt(0).toUpperCase())}</div>
    <button class="icon-btn" id="logoutBtn" title="Logout" aria-label="Logout"><i class="fa-solid fa-right-from-bracket"></i></button>`;
  $('logoutBtn').addEventListener('click', handleLogout);
}

/* ───────────── PLAYER ───────────── */
function showLoader(on){
  const o = $('playerOverlay');
  o.classList.toggle('show', on);
  o.innerHTML = on ? `<div class="loader-dots"><span></span><span></span><span></span></div>` : '';
}
function showError(msg){
  const o = $('playerOverlay');
  o.classList.add('show');
  o.innerHTML = `<div class="error-box"><i class="fa-solid fa-circle-exclamation"></i><p>${esc(msg || 'Stream unavailable')}</p>
    <button id="retryBtn">Retry</button></div>`;
  $('retryBtn').addEventListener('click', () => currentChannel && playChannel(currentChannel));
  $('liveBadge').classList.remove('show');
}
function destroyHls(){
  if(hls){ hls.destroy(); hls = null; }
  video.removeAttribute('src'); video.load();
  $('qualityList').innerHTML = '';
}
function updatePlayIcon(){
  const playing = !video.paused && !video.ended;
  $('btnPlay').innerHTML = `<i class="fa-solid ${playing ? 'fa-pause' : 'fa-play'}"></i>`;
  $('bigPlay').classList.toggle('show', !playing && !!currentChannel && !$('playerOverlay').classList.contains('show'));
  vWrap.classList.toggle('is-paused', !playing);
  if(playing) requestWake(); else releaseWake();
}
function updateMuteIcon(){
  const m = video.muted || video.volume === 0;
  $('btnMute').innerHTML = `<i class="fa-solid ${m ? 'fa-volume-xmark' : video.volume < .4 ? 'fa-volume-low' : 'fa-volume-high'}"></i>`;
}

let wakeLock = null;
async function requestWake(){ try{ if('wakeLock' in navigator && !wakeLock){ wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => wakeLock = null); } }catch(e){} }
function releaseWake(){ try{ wakeLock?.release(); }catch(e){} wakeLock = null; }
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && !video.paused) requestWake(); });

function setMediaSession(ch){
  if(!('mediaSession' in navigator)) return;
  try{
    navigator.mediaSession.metadata = new MediaMetadata({ title: ch.name, artist: ch.group || 'CrimsonTV', artwork: ch.logo ? [{ src: ch.logo }] : [] });
    navigator.mediaSession.setActionHandler('play', () => video.play());
    navigator.mediaSession.setActionHandler('pause', () => video.pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playRelative(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => playRelative(1));
  }catch(e){}
}

function addToRecent(url){
  recent = [url, ...recent.filter(u => u !== url)].slice(0, 40);
  store.set('ctv_recent', recent);
}

const isHlsUrl = u => !/\.(mp4|webm|mkv|mp3|aac|ogg)(\?|$)/i.test(u);

function applyFit(){ video.style.objectFit = settings.fit; document.querySelectorAll('#fitList button').forEach(b => b.classList.toggle('active', b.dataset.fit === settings.fit)); }

function buildQualityMenu(){
  const list = $('qualityList');
  if(!hls || !hls.levels || hls.levels.length < 2){
    list.innerHTML = `<button class="active" data-q="-1">Auto</button>`;
  } else {
    const lv = hls.levels.map((l, i) => ({ i, h: l.height || 0, b: l.bitrate || 0 })).sort((a, b) => b.h - a.h || b.b - a.b);
    list.innerHTML = `<button data-q="-1" class="${hls.currentLevel === -1 ? 'active' : ''}">Auto</button>` +
      lv.map(l => `<button data-q="${l.i}" class="${hls.currentLevel === l.i ? 'active' : ''}">${l.h ? l.h + 'p' : Math.round(l.b / 1000) + ' kbps'}</button>`).join('');
  }
  list.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    if(hls){ hls.currentLevel = parseInt(b.dataset.q, 10); toast(b.textContent); }
    list.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    closeGear();
  }));
}
function pickDefaultLevel(){
  if(!hls || hls.levels.length < 2 || settings.quality === 'auto') return;
  const sorted = hls.levels.map((l, i) => ({ i, h: l.height || 0, b: l.bitrate || 0 })).sort((a, b) => a.h - b.h || a.b - b.b);
  hls.currentLevel = (settings.quality === 'low' ? sorted[0] : sorted[sorted.length - 1]).i;
}

function playChannel(ch, opts = {}){
  if(!ch || !ch.url) return;
  if(currentPage !== 'home') go('home');
  currentChannel = ch;
  vWrap.classList.add('has-ch');
  hlsRetry = 0; mediaRetry = 0;
  $('chBadge').textContent = ch.name;
  $('npName').textContent = ch.name;
  $('npMeta').textContent = ch.group || 'Live';
  showLoader(true); updatePlayIcon();
  $('liveBadge').classList.add('show');
  markActive();
  destroyHls();
  store.set('ctv_last', { url: ch.url });
  addToRecent(ch.url);
  setMediaSession(ch);
  startStream(ch.url, opts);
  if(window.innerWidth < 1024) $('content').scrollTo({ top: 0, behavior: 'smooth' });
}

function startStream(url, opts = {}){
  const onPlaying = () => { showLoader(false); updatePlayIcon(); };
  const tryPlay = () => video.play().then(onPlaying).catch(() => { showLoader(false); updatePlayIcon(); });

  if(window.Hls && Hls.isSupported() && isHlsUrl(url)){
    hls = new Hls({
      enableWorker: true, lowLatencyMode: false, backBufferLength: 30,
      maxBufferLength: 30, maxMaxBufferLength: 60, startLevel: -1, capLevelToPlayerSize: true,
      manifestLoadingMaxRetry: 3, levelLoadingMaxRetry: 3, fragLoadingMaxRetry: 4
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => { pickDefaultLevel(); buildQualityMenu(); tryPlay(); });
    hls.on(Hls.Events.LEVEL_SWITCHED, buildQualityMenu);
    hls.on(Hls.Events.ERROR, (e, data) => {
      if(!data.fatal) return;
      if(data.type === Hls.ErrorTypes.NETWORK_ERROR){
        if(hlsRetry < 2){ hlsRetry++; toast('Reconnecting...'); setTimeout(() => hls && hls.startLoad(), 800 * hlsRetry); return; }
        const mixed = location.protocol === 'https:' && url.startsWith('http:');
        showError(mixed ? 'এই স্ট্রিমটি HTTP — HTTPS সাইটে ব্লক হচ্ছে। অন্য চ্যানেল চেষ্টা করুন।' : 'Network error. Stream বন্ধ বা ব্লকড হতে পারে।');
      } else if(data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetry < 2){
        mediaRetry++; hls.recoverMediaError();
      } else {
        showError('Stream error. অন্য চ্যানেল চেষ্টা করুন।');
      }
      updatePlayIcon();
    });
  } else {
    video.src = url;
    video.addEventListener('error', () => { showError('Stream failed to load'); updatePlayIcon(); }, { once: true });
    tryPlay();
  }
}

function markActive(){
  document.querySelectorAll('.ch-card').forEach(c => c.classList.toggle('active', !!currentChannel && c.dataset.url === currentChannel.url));
}

function playRelative(off){
  const list = getHomeList();
  if(!list.length) return;
  let i = currentChannel ? list.findIndex(c => c.url === currentChannel.url) : -1;
  i = i === -1 ? 0 : (i + off + list.length) % list.length;
  playChannel(list[i]);
}

/* fullscreen with iOS + pseudo fallback */
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
async function toggleFullscreen(){
  if(vWrap.classList.contains('pseudo-fs')){ vWrap.classList.remove('pseudo-fs'); updateFsIcon(false); return; }
  if(fsEl()){
    try{ screen.orientation?.unlock?.(); }catch(e){}
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    return;
  }
  try{
    if(vWrap.requestFullscreen) await vWrap.requestFullscreen();
    else if(vWrap.webkitRequestFullscreen) vWrap.webkitRequestFullscreen();
    else if(video.webkitEnterFullscreen) { video.webkitEnterFullscreen(); return; }
    else { vWrap.classList.add('pseudo-fs'); updateFsIcon(true); return; }
    try{ await screen.orientation?.lock?.('landscape'); }catch(e){}
  }catch(e){
    if(video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else { vWrap.classList.add('pseudo-fs'); updateFsIcon(true); }
  }
}
function updateFsIcon(on){ $('btnFs').innerHTML = `<i class="fa-solid ${on ? 'fa-compress' : 'fa-expand'}"></i>`; }

function closeGear(){ $('gearMenu').classList.remove('open'); }

function setupPlayer(){
  const toggle = () => { video.paused ? video.play().catch(() => {}) : video.pause(); };
  $('btnPlay').addEventListener('click', toggle);
  $('bigPlay').addEventListener('click', e => { e.stopPropagation(); toggle(); });
  $('btnMute').addEventListener('click', () => {
    video.muted = !video.muted;
    if(!video.muted && video.volume === 0) video.volume = .5;
    $('volSlider').value = video.muted ? 0 : video.volume; updateMuteIcon();
  });
  $('volSlider').addEventListener('input', e => { video.volume = parseFloat(e.target.value); video.muted = video.volume === 0; updateMuteIcon(); });
  $('btnFs').addEventListener('click', toggleFullscreen);
  $('btnPrev').addEventListener('click', () => playRelative(-1));
  $('btnNext').addEventListener('click', () => playRelative(1));
  $('btnPip').addEventListener('click', async () => {
    try{
      if(document.pictureInPictureElement) await document.exitPictureInPicture();
      else if(document.pictureInPictureEnabled) await video.requestPictureInPicture();
      else toast('PiP supported নয়');
    }catch(e){ toast('PiP supported নয়'); }
  });
  $('btnShare').addEventListener('click', async () => {
    if(!currentChannel) return toast('আগে চ্যানেল বেছে নিন');
    const text = `Watch ${currentChannel.name} on CrimsonTV`;
    try{
      if(navigator.share) await navigator.share({ title: currentChannel.name, text, url: location.href.split('#')[0] });
      else { await navigator.clipboard.writeText(text + ' — ' + location.href.split('#')[0]); toast('Copied!'); }
    }catch(e){}
  });
  $('btnGear').addEventListener('click', e => { e.stopPropagation(); $('gearMenu').classList.toggle('open'); });
  $('gearMenu').addEventListener('click', e => e.stopPropagation());
  document.querySelectorAll('#fitList button').forEach(b => b.addEventListener('click', () => {
    settings.fit = b.dataset.fit; store.set('ctv_settings', settings); applyFit(); $('setFit').value = settings.fit; closeGear();
  }));

  video.addEventListener('play', updatePlayIcon);
  video.addEventListener('pause', updatePlayIcon);
  video.addEventListener('volumechange', updateMuteIcon);
  video.addEventListener('waiting', () => { if(currentChannel && !video.paused) showLoader(true); });
  video.addEventListener('playing', () => { showLoader(false); updatePlayIcon(); });
  video.addEventListener('canplay', () => { if(!video.paused) showLoader(false); });
  document.addEventListener('fullscreenchange', () => updateFsIcon(!!fsEl()));
  document.addEventListener('webkitfullscreenchange', () => updateFsIcon(!!fsEl()));

  /* controls auto-hide + tap / double-tap */
  let hideT, lastTap = 0, tapT;
  const show = () => { vWrap.classList.add('show-ctrl'); clearTimeout(hideT); hideT = setTimeout(() => { if(!video.paused){ vWrap.classList.remove('show-ctrl'); closeGear(); } }, 3500); };
  const flash = id => { const el = $(id); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 400); };
  vWrap.addEventListener('mousemove', show);
  vWrap.addEventListener('click', e => {
    if(e.target.closest('.pc-bar, .big-play, .gear-menu, .error-box')) return;
    const now = Date.now();
    const r = vWrap.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
    if(now - lastTap < 300){
      clearTimeout(tapT);
      if(x < .33){ flash('hintL'); playRelative(-1); }
      else if(x > .66){ flash('hintR'); playRelative(1); }
      else toggleFullscreen();
      lastTap = 0; return;
    }
    lastTap = now;
    tapT = setTimeout(() => {
      if(vWrap.classList.contains('show-ctrl') && !video.paused){ vWrap.classList.remove('show-ctrl'); closeGear(); } else show();
    }, 280);
  });
  vWrap.addEventListener('touchstart', show, { passive: true });

  document.addEventListener('keydown', e => {
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if(k === ' ' || k === 'k'){ e.preventDefault(); toggle(); }
    else if(k === 'f'){ e.preventDefault(); toggleFullscreen(); }
    else if(k === 'm'){ e.preventDefault(); $('btnMute').click(); }
    else if(k === 'arrowleft'){ e.preventDefault(); playRelative(-1); }
    else if(k === 'arrowright'){ e.preventDefault(); playRelative(1); }
    else if(k === 'arrowup'){ e.preventDefault(); video.volume = Math.min(1, video.volume + .1); video.muted = false; $('volSlider').value = video.volume; }
    else if(k === 'arrowdown'){ e.preventDefault(); video.volume = Math.max(0, video.volume - .1); $('volSlider').value = video.volume; }
    else if(k === 'escape'){ vWrap.classList.remove('pseudo-fs'); updateFsIcon(false); closeGear(); }
  });
  document.addEventListener('click', e => { if(!e.target.closest('#gearMenu, #btnGear')) closeGear(); });
  applyFit(); updateMuteIcon(); updatePlayIcon();
}

/* ───────────── CHANNEL LISTS ───────────── */
function cardHtml(ch){
  const fav = favorites.includes(ch.url);
  const active = currentChannel && currentChannel.url === ch.url;
  return `<div class="ch-card ${active ? 'active' : ''}" data-url="${esc(ch.url)}" role="button" tabindex="0">
    <span class="ch-live">LIVE</span>
    <button class="fav-btn ${fav ? 'active' : ''}" data-fav="${esc(ch.url)}" aria-label="Favorite"><i class="fa-${fav ? 'solid' : 'regular'} fa-heart"></i></button>
    ${ch.logo ? `<img src="${esc(ch.logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'fa-solid fa-tv ph'}))">` : `<i class="fa-solid fa-tv ph"></i>`}
    <div class="ch-name">${esc(ch.name)}</div></div>`;
}
function renderGrid(el, list, emptyMsg, icon = 'fa-tv'){
  el.innerHTML = list.length ? list.map(cardHtml).join('')
    : `<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${esc(emptyMsg)}</p></div>`;
}
function bindGrid(el){
  const activate = card => { const ch = channels[idxOf(card.dataset.url)]; if(ch) playChannel(ch); };
  el.addEventListener('click', e => {
    const f = e.target.closest('.fav-btn');
    if(f){ e.stopPropagation(); toggleFavorite(f.dataset.fav); return; }
    const c = e.target.closest('.ch-card'); if(c) activate(c);
  });
  el.addEventListener('keydown', e => { if(e.key === 'Enter'){ const c = e.target.closest('.ch-card'); if(c) activate(c); } });
}

function getHomeList(){
  return activeCategory === 'All' ? channels : channels.filter(c => (c.group || 'General') === activeCategory);
}
function renderCategories(){
  const groups = Array.from(new Set(channels.map(c => c.group || 'General'))).sort((a, b) => a.localeCompare(b));
  $('catTabs').innerHTML = ['All', ...groups].map(g => `<button class="cat-tab ${g === activeCategory ? 'active' : ''}" data-cat="${esc(g)}">${esc(g)}</button>`).join('');
}
function renderHome(){
  const list = getHomeList();
  const slice = list.slice(0, shown);
  renderGrid($('chGrid'), slice, channels.length ? 'কোনো চ্যানেল পাওয়া যায়নি' : 'Loading...');
  $('moreBtn').style.display = list.length > shown ? 'block' : 'none';
  $('moreBtn').textContent = `Show more (${list.length - shown})`;
}
function renderFav(){ renderGrid($('favGrid'), channels.filter(c => favorites.includes(c.url)), 'এখনো কোনো ফেভারিট নেই। যেকোনো চ্যানেলের হার্টে ট্যাপ করুন।', 'fa-heart'); }
function renderHistory(){ renderGrid($('historyGrid'), recent.map(u => channels[idxOf(u)]).filter(Boolean), 'এখনো কিছু দেখা হয়নি।', 'fa-clock-rotate-left'); }
function renderSearch(){
  const q = searchQuery.toLowerCase();
  const list = q ? channels.filter(c => c.name.toLowerCase().includes(q) || (c.group || '').toLowerCase().includes(q)).slice(0, 200) : [];
  renderGrid($('searchGrid'), list, q ? 'কিছু পাওয়া যায়নি' : 'চ্যানেলের নাম লিখে খুঁজুন', 'fa-magnifying-glass');
}
function refreshLists(){
  renderHome();
  if(currentPage === 'fav') renderFav();
  if(currentPage === 'history') renderHistory();
  if(currentPage === 'search') renderSearch();
}

async function toggleFavorite(url){
  const i = favorites.indexOf(url);
  i === -1 ? favorites.push(url) : favorites.splice(i, 1);
  store.set('ctv_favs', favorites);
  if(currentUser && fb){
    try{ await fb.updateDoc(fb.doc(fb.db, 'users', currentUser.uid), { favorites: i === -1 ? fb.arrayUnion(url) : fb.arrayRemove(url) }); }catch(e){}
  }
  refreshLists();
}

/* ───────────── ADS (isolated iframes — fixes shared atOptions / sizing / hidden-page issues) ───────────── */
const mounted = {};
function adDoc(type){
  if(type === 'banner'){
    const a = ADS.banner;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}</style></head><body>
<script>atOptions={'key':'${a.key}','format':'iframe','height':${a.h},'width':${a.w},'params':{}};<\/script>
<script src="https://www.highrevenueformat.com/${a.key}/invoke.js"><\/script></body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank"><style>html,body{margin:0;padding:0;background:transparent}</style></head><body>
<script async data-cfasync="false" src="${ADS.native.src}"><\/script><div id="${ADS.native.id}"></div></body></html>`;
}
function mountAd(slotId, type){
  const slot = $(slotId);
  if(!slot || mounted[slotId]) return;
  const avail = Math.floor(slot.getBoundingClientRect().width);
  if(avail < 120) return;                       // slot hidden (other page) — try again when shown
  mounted[slotId] = true;
  const f = document.createElement('iframe');
  f.className = 'ad-frame'; f.title = 'Advertisement'; f.loading = 'lazy'; f.scrolling = 'no';
  f.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
  if(type === 'banner'){
    const { w, h } = ADS.banner;
    f.width = w; f.height = h;
    const wrap = document.createElement('div'); wrap.className = 'ad-wrap'; wrap.dataset.type = 'banner';
    wrap.appendChild(f); slot.appendChild(wrap);
    fitBanner(wrap);
  } else {
    f.style.width = '100%'; f.style.maxWidth = '600px'; f.style.height = '280px';
    slot.appendChild(f);
  }
  f.srcdoc = adDoc(type);
  const old = slot.querySelector('.ad-label');
  if(!old){ const l = document.createElement('div'); l.className = 'ad-label'; l.textContent = 'Advertisement'; slot.prepend(l); slot.style.flexDirection = 'column'; }
}
function fitBanner(wrap){
  const { w, h } = ADS.banner, f = wrap.firstElementChild;
  const avail = wrap.parentElement.getBoundingClientRect().width;
  if(avail < 50) return;
  const s = Math.min(1, avail / w);
  f.style.transform = `scale(${s})`;
  wrap.style.width = Math.round(w * s) + 'px';
  wrap.style.height = Math.round(h * s) + 'px';
}
function mountAdsForPage(page){
  const map = { home: [['adTop', 'banner'], ['adNative', 'native']], settings: [['adSettings', 'banner']] };
  (map[page] || []).forEach(([id, t], i) => setTimeout(() => mountAd(id, t), 300 + i * 600));
}
window.addEventListener('resize', () => document.querySelectorAll('.ad-wrap[data-type="banner"]').forEach(fitBanner));

/* ───────────── SETTINGS / FAQ / SUPPORT ───────────── */
function setupSettings(){
  $('setAutoplay').checked = !!settings.autoplay;
  $('setQuality').value = settings.quality;
  $('setFit').value = settings.fit;
  $('setGrid').value = settings.grid;
  document.body.dataset.grid = settings.grid;
  const save = () => store.set('ctv_settings', settings);
  $('setAutoplay').addEventListener('change', e => { settings.autoplay = e.target.checked; save(); });
  $('setQuality').addEventListener('change', e => { settings.quality = e.target.value; save(); if(hls) pickDefaultLevel(); });
  $('setFit').addEventListener('change', e => { settings.fit = e.target.value; save(); applyFit(); });
  $('setGrid').addEventListener('change', e => { settings.grid = e.target.value; document.body.dataset.grid = settings.grid; save(); });
  const clearHist = () => { recent = []; store.set('ctv_recent', recent); renderHistory(); toast('History cleared'); };
  $('setClearHist').addEventListener('click', clearHist);
  $('clearHistory').addEventListener('click', clearHist);
  $('setClearFav').addEventListener('click', async () => {
    if(!confirm('সব ফেভারিট মুছে ফেলবেন?')) return;
    favorites = []; store.set('ctv_favs', favorites);
    if(currentUser && fb){ try{ await fb.updateDoc(fb.doc(fb.db, 'users', currentUser.uid), { favorites: [] }); }catch(e){} }
    refreshLists(); toast('Favorites cleared');
  });
  $('setReload').addEventListener('click', () => { loadChannels(true); toast('Reloading playlist...'); });
}
function setupFaq(){
  $('faqList').innerHTML = FAQS.map(([q, a]) =>
    `<div class="faq-item"><button class="faq-q"><span>${esc(q)}</span><i class="fa-solid fa-chevron-down"></i></button><div class="faq-a">${esc(a)}</div></div>`).join('');
  $('faqList').addEventListener('click', e => { const b = e.target.closest('.faq-q'); if(b) b.parentElement.classList.toggle('open'); });
}
function setupSupport(){
  $('supSend').addEventListener('click', async () => {
    const msg = $('supMsg').value.trim();
    if(msg.length < 5) return alert('অনুগ্রহ করে সমস্যাটি একটু বিস্তারিত লিখুন।');
    const payload = { name: $('supName').value.trim() || (currentUser?.displayName || 'Guest'), type: $('supType').value, message: msg,
      channel: currentChannel?.name || '', userEmail: currentUser?.email || '', ua: navigator.userAgent.slice(0, 160) };
    const btn = $('supSend'); btn.disabled = true;
    try{
      if(!fb) throw new Error('no firebase');
      await fb.addDoc(fb.collection(fb.db, 'support_messages'), { ...payload, createdAt: fb.serverTimestamp() });
      $('supMsg').value = ''; alert('ধন্যবাদ! আপনার বার্তা পাঠানো হয়েছে।');
    }catch(e){
      const text = `CrimsonTV Support\nName: ${payload.name}\nType: ${payload.type}\nChannel: ${payload.channel}\n\n${payload.message}`;
      try{ await navigator.clipboard.writeText(text); alert('বার্তা কপি হয়েছে। ' + DEV_URL + ' সাইটের মাধ্যমে ডেভেলপারকে পাঠান।'); }
      catch(_){ window.open(DEV_URL, '_blank', 'noopener'); }
    }
    btn.disabled = false;
  });
}

/* ───────────── LOAD CHANNELS ───────────── */
async function loadChannels(force){
  const cached = !force && store.get('ctv_playlist', null);
  if(cached && cached.length){ channels = cached; onChannels(true); }
  else $('chGrid').innerHTML = `<div class="empty-state"><div class="loader-dots" style="justify-content:center"><span></span><span></span><span></span></div><p style="margin-top:14px">Loading channels...</p></div>`;
  try{
    const fresh = await loadM3U(M3U_URL);
    if(!fresh.length) throw new Error('No channels found in playlist');
    channels = fresh;
    store.set('ctv_playlist', fresh.map(({ name, logo, group, url }) => ({ name, logo, group, url })));
    onChannels(false);
  }catch(err){
    console.error(err);
    if(!channels.length){
      $('chGrid').innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>চ্যানেল লোড হয়নি<br><small>${esc(err.message)}</small></p></div>`;
      $('moreBtn').style.display = 'none';
    }
  }
}
let autoplayDone = false;
function onChannels(){
  renderCategories(); renderHome(); refreshLists();
  if(!autoplayDone && settings.autoplay){
    autoplayDone = true;
    const last = store.get('ctv_last', null);
    const ch = last && channels[idxOf(last.url)];
    if(ch) setTimeout(() => playChannel(ch), 300);
  }
}

/* ───────────── INIT ───────────── */
function init(){
  buildNav();
  setupPlayer(); setupSettings(); setupFaq(); setupSupport();
  updateUserUI();

  ['chGrid', 'favGrid', 'historyGrid', 'searchGrid'].forEach(id => bindGrid($(id)));
  $('catTabs').addEventListener('click', e => {
    const b = e.target.closest('.cat-tab'); if(!b) return;
    activeCategory = b.dataset.cat; shown = PAGE_SIZE; renderCategories(); renderHome();
  });
  $('moreBtn').addEventListener('click', () => { shown += PAGE_SIZE; renderHome(); });

  // search (topbar for desktop + search page)
  const onSearch = v => {
    searchQuery = v.trim();
    $('searchInput').value = v; $('pageSearchInput').value = v;
    $('searchClear').classList.toggle('show', !!searchQuery);
    if(currentPage !== 'search') go('search'); else renderSearch();
  };
  $('searchInput').addEventListener('input', e => onSearch(e.target.value));
  $('pageSearchInput').addEventListener('input', e => onSearch(e.target.value));
  $('searchClear').addEventListener('click', () => { onSearch(''); $('searchInput').focus(); });

  // auth
  document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));
  $('loginForm').addEventListener('submit', handleLogin);
  $('registerForm').addEventListener('submit', handleRegister);
  $('googleBtn').addEventListener('click', handleGoogle);
  $('skipAuth').addEventListener('click', () => $('authOverlay').classList.add('hidden'));
  $('authClose').addEventListener('click', () => $('authOverlay').classList.add('hidden'));

  go(location.hash.slice(1) || 'home', true);
  loadChannels();
  initFirebase();
}
init();

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  // no SW registered on purpose: keeps updates instant for a static host
}
