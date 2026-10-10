/* ═══════════════════════════════════════════════════
   CrimsonTV — Main Application (Enhanced)
═══════════════════════════════════════════════════ */

import {
  auth, db, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, signInWithPopup, googleProvider, updateProfile,
  doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove
} from './firebase-config.js';

import { loadM3U, groupChannels } from './m3u-parser.js';

/* ───────────── CONFIG ───────────── */
const M3U_URL = 'https://raw.githubusercontent.com/ahan443/FAST-IPTV/refs/heads/main/premium121.m3u';

/* ───────────── STATE ───────────── */
let channels = [];
let currentChannel = null;
let currentUser = null;
let favorites = JSON.parse(localStorage.getItem('ctv_favs') || '[]');
let recentChannels = JSON.parse(localStorage.getItem('ctv_recent') || '[]'); // array of urls
let activeCategory = 'All';
let hls = null;
let searchQuery = '';
let appInitialized = false;
let currentPage = 'home'; // home | fav | recent | search

/* ───────────── DOM ───────────── */
const $ = id => document.getElementById(id);
const authOverlay   = $('authOverlay');
const appEl         = $('app');
const video         = $('video');
const playerOverlay = $('playerOverlay');
const chGrid        = $('chGrid');
const catTabs       = $('catTabs');
const pcName        = $('pcName');
const pcMeta        = $('pcMeta');
const searchInput   = $('searchInput');
const userArea      = $('userArea');
const vWrap         = $('vWrap');
const bigPlay       = $('bigPlay');
const volSlider     = $('volSlider');
const mobileSearchOverlay = $('mobileSearchOverlay');
const mobileSearchInput = $('mobileSearchInput');

/* ───────────── AUTH ───────────── */
function showAuthError(msg){
  const el = $('authError');
  el.textContent = msg;
  el.classList.add('show');
}
function clearAuthError(){
  $('authError').classList.remove('show');
}

function switchAuthTab(tab){
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  $('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  $('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  clearAuthError();
}

async function handleLogin(e){
  e.preventDefault();
  clearAuthError();
  const email = $('loginEmail').value.trim();
  const pass  = $('loginPass').value;
  const btn = $('loginBtn');
  btn.disabled = true; btn.textContent = 'Signing in...';
  try{
    await signInWithEmailAndPassword(auth, email, pass);
  }catch(err){
    showAuthError(err.message.replace('Firebase: ',''));
  }
  btn.disabled = false; btn.textContent = 'Sign In';
}

async function handleRegister(e){
  e.preventDefault();
  clearAuthError();
  const name  = $('regName').value.trim();
  const email = $('regEmail').value.trim();
  const pass  = $('regPass').value;
  if(pass.length < 6){ showAuthError('Password must be at least 6 characters'); return; }
  const btn = $('regBtn');
  btn.disabled = true; btn.textContent = 'Creating...';
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if(name) await updateProfile(cred.user, { displayName: name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      name: name || email.split('@')[0],
      email,
      favorites: [],
      createdAt: new Date().toISOString()
    });
  }catch(err){
    showAuthError(err.message.replace('Firebase: ',''));
  }
  btn.disabled = false; btn.textContent = 'Create Account';
}

async function handleGoogle(){
  clearAuthError();
  try{
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if(!snap.exists()){
      await setDoc(ref, {
        name: user.displayName || 'User',
        email: user.email,
        favorites: [],
        createdAt: new Date().toISOString()
      });
    }
  }catch(err){
    showAuthError(err.message.replace('Firebase: ',''));
  }
}

function skipAuth(){
  authOverlay.classList.add('hidden');
  appEl.classList.add('ready');
  initApp();
}

async function handleLogout(){
  await signOut(auth);
  favorites = JSON.parse(localStorage.getItem('ctv_favs') || '[]');
  location.reload();
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if(user){
    authOverlay.classList.add('hidden');
    appEl.classList.add('ready');
    try{
      const snap = await getDoc(doc(db, 'users', user.uid));
      if(snap.exists() && Array.isArray(snap.data().favorites)){
        favorites = snap.data().favorites;
      }
    }catch(e){}
    updateUserUI();
    initApp();
  }
});

function updateUserUI(){
  if(!currentUser){
    userArea.innerHTML = `<button class="user-btn" id="loginPromptBtn">Login</button>`;
    $('loginPromptBtn')?.addEventListener('click', () => {
      authOverlay.classList.remove('hidden');
    });
    return;
  }
  const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
  const initial = name.charAt(0).toUpperCase();
  userArea.innerHTML = `
    <div class="user-btn" id="userMenuBtn">
      <div class="user-avatar">${initial}</div>
      <span>${name}</span>
    </div>
    <button class="pc-btn" title="Logout" id="logoutBtn" style="width:34px;height:34px;border-radius:9px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#fca5a5;cursor:pointer">
      <i class="fa-solid fa-right-from-bracket"></i>
    </button>
  `;
  $('logoutBtn')?.addEventListener('click', handleLogout);
}

/* ───────────── PLAYER ───────────── */
function showLoader(show){
  playerOverlay.classList.toggle('show', show);
  playerOverlay.innerHTML = show
    ? `<div class="loader-dots"><span></span><span></span><span></span></div>`
    : '';
}

function showError(msg){
  playerOverlay.classList.add('show');
  playerOverlay.innerHTML = `
    <div class="error-box">
      <i class="fa-solid fa-circle-exclamation"></i>
      <p>${msg || 'Stream unavailable'}</p>
      <button onclick="window.retryChannel()">Retry</button>
    </div>
  `;
}

function destroyHls(){
  if(hls){
    hls.destroy();
    hls = null;
  }
  video.removeAttribute('src');
  video.load();
}

function updatePlayIcon(playing){
  const icon = playing ? 'fa-pause' : 'fa-play';
  const btn = $('btnPlay');
  if(btn) btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
  if(bigPlay){
    if(playing){
      bigPlay.classList.remove('show');
      vWrap.classList.remove('is-paused');
    } else {
      bigPlay.classList.add('show');
      vWrap.classList.add('is-paused');
    }
  }
}

function updateMuteIcon(){
  const muted = video.muted || video.volume === 0;
  $('btnMute').innerHTML = muted
    ? `<i class="fa-solid fa-volume-xmark"></i>`
    : video.volume < 0.4
      ? `<i class="fa-solid fa-volume-low"></i>`
      : `<i class="fa-solid fa-volume-high"></i>`;
}

function updateFsIcon(isFs){
  $('btnFs').innerHTML = isFs
    ? `<i class="fa-solid fa-compress"></i>`
    : `<i class="fa-solid fa-expand"></i>`;
}

function addToRecent(url){
  recentChannels = recentChannels.filter(u => u !== url);
  recentChannels.unshift(url);
  if(recentChannels.length > 30) recentChannels = recentChannels.slice(0, 30);
  localStorage.setItem('ctv_recent', JSON.stringify(recentChannels));
}

function playChannel(ch){
  if(!ch || !ch.url) return;
  currentChannel = ch;
  pcName.textContent = ch.name;
  pcMeta.textContent = ch.group || '';
  showLoader(true);
  updatePlayIcon(false);

  // mark active card
  document.querySelectorAll('.ch-card').forEach(c => {
    c.classList.toggle('active', c.dataset.url === ch.url);
  });

  destroyHls();

  // remember last channel
  localStorage.setItem('ctv_last', JSON.stringify({ url: ch.url, name: ch.name }));
  addToRecent(ch.url);

  const url = ch.url;
  const headers = ch.headers || {};

  if(window.Hls && Hls.isSupported() && (url.includes('.m3u8') || url.includes('m3u8') || url.includes('/live/') || url.includes('playlist'))){
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      xhrSetup: function(xhr) {
        // Apply custom headers if available
        Object.keys(headers).forEach(k => {
          try { xhr.setRequestHeader(k, headers[k]); } catch(e) {}
        });
      }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().then(() => {
        showLoader(false);
        updatePlayIcon(true);
      }).catch(() => {
        showLoader(false);
        updatePlayIcon(false);
      });
    });
    hls.on(Hls.Events.ERROR, (e, data) => {
      if(data.fatal){
        if(data.type === Hls.ErrorTypes.NETWORK_ERROR){
          showError('Network error. Stream may be offline or blocked.');
        } else {
          showError('Stream error. Try another channel.');
        }
        updatePlayIcon(false);
      }
    });
  } else if(video.canPlayType('application/vnd.apple.mpegurl')){
    // Safari native HLS
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      video.play().then(() => {
        showLoader(false);
        updatePlayIcon(true);
      }).catch(() => showLoader(false));
    }, { once: true });
    video.addEventListener('error', () => {
      showError('Stream failed to load');
      updatePlayIcon(false);
    }, { once: true });
  } else {
    // progressive / direct
    video.src = url;
    video.play().then(() => {
      showLoader(false);
      updatePlayIcon(true);
    }).catch(() => {
      showError('Cannot play this stream');
      updatePlayIcon(false);
    });
  }
}

window.retryChannel = () => {
  if(currentChannel) playChannel(currentChannel);
};

/* ───────────── CHANNELS ───────────── */
function renderCategories(){
  const groups = ['All', 'Favorites', 'Recent', ...Object.keys(groupChannels(channels)).sort()];
  catTabs.innerHTML = groups.map(g =>
    `<button class="cat-tab ${g === activeCategory ? 'active' : ''}" data-cat="${g}">${g}</button>`
  ).join('');

  catTabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      currentPage = activeCategory === 'Favorites' ? 'fav' : activeCategory === 'Recent' ? 'recent' : 'home';
      updateBottomNav();
      renderCategories();
      renderChannels();
    });
  });
}

function getFilteredChannels(){
  let list = channels;
  if(activeCategory === 'Favorites'){
    list = channels.filter(c => favorites.includes(c.url));
  } else if(activeCategory === 'Recent'){
    list = recentChannels
      .map(url => channels.find(c => c.url === url))
      .filter(Boolean);
  } else if(activeCategory !== 'All'){
    list = channels.filter(c => (c.group || 'General') === activeCategory);
  }
  if(searchQuery){
    const q = searchQuery.toLowerCase();
    list = list.filter(c => c.name.toLowerCase().includes(q) || (c.group||'').toLowerCase().includes(q));
  }
  return list;
}

function renderChannels(){
  const list = getFilteredChannels();
  if(!list.length){
    const msg = searchQuery
      ? 'No channels match your search'
      : activeCategory === 'Favorites'
        ? 'No favorites yet. Tap the heart on any channel!'
        : activeCategory === 'Recent'
          ? 'No recently watched channels'
          : 'No channels found';
    chGrid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-tv"></i><p>${msg}</p></div>`;
    return;
  }
  chGrid.innerHTML = list.map(ch => {
    const isFav = favorites.includes(ch.url);
    const isActive = currentChannel && currentChannel.url === ch.url;
    return `
      <div class="ch-card ${isActive ? 'active' : ''}" data-url="${ch.url}">
        <button class="fav-btn ${isFav ? 'active' : ''}" data-url="${ch.url}" title="Favorite">
          <i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i>
        </button>
        ${ch.logo
          ? `<img src="${ch.logo}" alt="" loading="lazy" onerror="this.style.display='none'">`
          : `<i class="fa-solid fa-tv" style="font-size:1.6rem;color:var(--tx3);opacity:.5"></i>`}
        <div class="ch-name">${ch.name}</div>
      </div>
    `;
  }).join('');

  chGrid.querySelectorAll('.ch-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if(e.target.closest('.fav-btn')) return;
      const ch = channels.find(c => c.url === card.dataset.url);
      if(ch) playChannel(ch);
    });
  });

  chGrid.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.url);
    });
  });
}

async function toggleFavorite(url){
  const idx = favorites.indexOf(url);
  if(idx === -1) favorites.push(url);
  else favorites.splice(idx, 1);

  localStorage.setItem('ctv_favs', JSON.stringify(favorites));

  if(currentUser){
    try{
      const ref = doc(db, 'users', currentUser.uid);
      if(idx === -1) await updateDoc(ref, { favorites: arrayUnion(url) });
      else await updateDoc(ref, { favorites: arrayRemove(url) });
    }catch(e){}
  }
  renderChannels();
}

/* ───────────── NAVIGATION ───────────── */
function updateBottomNav(){
  document.querySelectorAll('.bn-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === currentPage);
  });
}

function switchPage(page){
  currentPage = page;
  updateBottomNav();

  if(page === 'search'){
    mobileSearchOverlay.classList.add('open');
    mobileSearchInput.value = searchQuery;
    mobileSearchInput.focus();
    return;
  }

  mobileSearchOverlay.classList.remove('open');

  if(page === 'fav'){
    activeCategory = 'Favorites';
  } else if(page === 'recent'){
    activeCategory = 'Recent';
  } else {
    activeCategory = 'All';
  }
  searchQuery = '';
  if(searchInput) searchInput.value = '';
  if(mobileSearchInput) mobileSearchInput.value = '';
  renderCategories();
  renderChannels();
}

/* ───────────── CONTROLS ───────────── */
function getCurrentIndex(){
  if(!currentChannel) return -1;
  const list = getFilteredChannels();
  return list.findIndex(c => c.url === currentChannel.url);
}

function playRelative(offset){
  const list = getFilteredChannels();
  if(!list.length) return;
  let idx = getCurrentIndex();
  if(idx === -1) idx = 0;
  else idx = (idx + offset + list.length) % list.length;
  playChannel(list[idx]);
}

function toggleFullscreen(){
  const el = vWrap;
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);

  if(!isFs){
    // Try standard first
    if(el.requestFullscreen){
      el.requestFullscreen().catch(() => {
        // iOS fallback
        if(video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      });
    } else if(el.webkitRequestFullscreen){
      el.webkitRequestFullscreen();
    } else if(video.webkitEnterFullscreen){
      video.webkitEnterFullscreen();
    }
  } else {
    if(document.exitFullscreen) document.exitFullscreen();
    else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
}

function setupControls(){
  // Play / Pause
  $('btnPlay')?.addEventListener('click', () => {
    if(video.paused) video.play().catch(()=>{});
    else video.pause();
  });
  bigPlay?.addEventListener('click', (e) => {
    e.stopPropagation();
    if(video.paused) video.play().catch(()=>{});
    else video.pause();
  });

  // Mute
  $('btnMute')?.addEventListener('click', () => {
    video.muted = !video.muted;
    if(!video.muted && video.volume === 0) video.volume = 0.5;
    updateMuteIcon();
    if(volSlider) volSlider.value = video.muted ? 0 : video.volume;
  });

  // Volume slider
  volSlider?.addEventListener('input', () => {
    video.volume = parseFloat(volSlider.value);
    video.muted = video.volume === 0;
    updateMuteIcon();
  });

  // Fullscreen
  $('btnFs')?.addEventListener('click', toggleFullscreen);

  // Prev / Next
  $('btnPrev')?.addEventListener('click', () => playRelative(-1));
  $('btnNext')?.addEventListener('click', () => playRelative(1));

  // PiP
  $('btnPip')?.addEventListener('click', async () => {
    try{
      if(document.pictureInPictureElement){
        await document.exitPictureInPicture();
      } else if(document.pictureInPictureEnabled){
        await video.requestPictureInPicture();
      }
    }catch(e){}
  });

  // Share
  $('btnShare')?.addEventListener('click', async () => {
    if(!currentChannel) return;
    const text = `Watch ${currentChannel.name} on CrimsonTV`;
    try{
      if(navigator.share){
        await navigator.share({ title: currentChannel.name, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Channel name copied!');
      }
    }catch(e){}
  });

  // Video events
  video.addEventListener('play', () => updatePlayIcon(true));
  video.addEventListener('pause', () => updatePlayIcon(false));
  video.addEventListener('volumechange', updateMuteIcon);

  // Fullscreen change
  document.addEventListener('fullscreenchange', () => {
    updateFsIcon(!!document.fullscreenElement);
  });
  document.addEventListener('webkitfullscreenchange', () => {
    updateFsIcon(!!document.webkitFullscreenElement);
  });

  // Auto-hide controls
  let ctrlTimer;
  const showCtrl = () => {
    vWrap.classList.add('show-ctrl');
    clearTimeout(ctrlTimer);
    ctrlTimer = setTimeout(() => {
      if(!video.paused) vWrap.classList.remove('show-ctrl');
    }, 3500);
  };
  vWrap.addEventListener('mousemove', showCtrl);
  vWrap.addEventListener('click', (e) => {
    // Don't toggle if clicking controls
    if(e.target.closest('.pc-bar') || e.target.closest('.big-play')) return;
    showCtrl();
  });
  vWrap.addEventListener('touchstart', showCtrl, { passive: true });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if(e.target.tagName === 'INPUT') return;
    switch(e.key.toLowerCase()){
      case ' ':
      case 'k':
        e.preventDefault();
        if(video.paused) video.play().catch(()=>{});
        else video.pause();
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
        e.preventDefault();
        video.muted = !video.muted;
        updateMuteIcon();
        break;
      case 'arrowleft':
        e.preventDefault();
        playRelative(-1);
        break;
      case 'arrowright':
        e.preventDefault();
        playRelative(1);
        break;
      case 'arrowup':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        if(volSlider) volSlider.value = video.volume;
        updateMuteIcon();
        break;
      case 'arrowdown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        if(volSlider) volSlider.value = video.volume;
        updateMuteIcon();
        break;
    }
  });
}


/* ───────────── ADS ───────────── */
let adsLoaded = false;
function loadAds(){
  if(adsLoaded) return;
  adsLoaded = true;

  // Helper: load classic Adsterra banner into a container
  function loadBanner(containerId, key, width, height){
    const el = document.getElementById(containerId);
    if(!el) return;
    // Clear previous
    el.innerHTML = '';
    // Set global atOptions then inject scripts
    window.atOptions = {
      key: key,
      format: 'iframe',
      height: height,
      width: width,
      params: {}
    };
    const s1 = document.createElement('script');
    s1.textContent = `atOptions = ${JSON.stringify(window.atOptions)};`;
    el.appendChild(s1);
    const s2 = document.createElement('script');
    s2.src = `https://www.highrevenueformat.com/${key}/invoke.js`;
    el.appendChild(s2);
  }

  // 728x90 Desktop
  loadBanner('ad728', '7e9627f51376c6e4560f12209f0e099f', 728, 90);

  // Small delay between loads to avoid atOptions race
  setTimeout(() => {
    // 300x250
    loadBanner('ad300', '2915cb11d1536351ed66f3d5f50d9c1d', 300, 250);
  }, 300);

  setTimeout(() => {
    // 320x50 Mobile
    loadBanner('ad320', 'e5feb0a10e872208b4ecaa296b076074', 320, 50);
  }, 600);

  // Native Banner (different format)
  setTimeout(() => {
    const nativeEl = document.getElementById('adNative');
    if(!nativeEl) return;
    nativeEl.innerHTML = '';
    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.src = 'https://pl31756762.profitableratecpmnetwork.com/0cd45fb864f5b70ccb28b69d91843ea3/invoke.js';
    nativeEl.appendChild(s);
    const div = document.createElement('div');
    div.id = 'container-0cd45fb864f5b70ccb28b69d91843ea3';
    nativeEl.appendChild(div);
  }, 900);
}

/* ───────────── INIT ───────────── */
async function initApp(){
  if(appInitialized) return;
  appInitialized = true;

  updateUserUI();
  setupControls();

  // Desktop search
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    $('searchClear')?.classList.toggle('show', !!searchQuery);
    renderChannels();
  });
  $('searchClear')?.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    $('searchClear').classList.remove('show');
    renderChannels();
  });

  // Mobile search
  mobileSearchInput?.addEventListener('input', () => {
    searchQuery = mobileSearchInput.value.trim();
    renderChannels();
  });
  $('mobileSearchClose')?.addEventListener('click', () => {
    mobileSearchOverlay.classList.remove('open');
    currentPage = activeCategory === 'Favorites' ? 'fav' : activeCategory === 'Recent' ? 'recent' : 'home';
    updateBottomNav();
  });

  // Bottom nav
  document.querySelectorAll('.bn-item').forEach(item => {
    item.addEventListener('click', () => switchPage(item.dataset.page));
  });

  // Load channels
  chGrid.innerHTML = `<div class="empty-state"><div class="loader-dots" style="justify-content:center"><span></span><span></span><span></span></div><p style="margin-top:14px">Loading channels...</p></div>`;

  try{
    channels = await loadM3U(M3U_URL);
    if(!channels.length) throw new Error('No channels found in playlist');
    renderCategories();
    renderChannels();

    // Auto-play last channel if available
    try{
      const last = JSON.parse(localStorage.getItem('ctv_last') || 'null');
      if(last && last.url){
        const ch = channels.find(c => c.url === last.url);
        if(ch) setTimeout(() => playChannel(ch), 400);
      }
    }catch(e){}
  }catch(err){
    console.error(err);
    chGrid.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to load channels<br><small style="opacity:.7">${err.message}</small></p>
      <button class="auth-btn" style="margin-top:14px;width:auto;padding:9px 18px" onclick="location.reload()">Retry</button></div>`;
  }

  // Load ads after UI is visible
  setTimeout(loadAds, 800);
}

/* ───────────── EVENT BINDINGS ───────────── */
document.querySelectorAll('.auth-tab').forEach(t => {
  t.addEventListener('click', () => switchAuthTab(t.dataset.tab));
});
$('loginForm')?.addEventListener('submit', handleLogin);
$('registerForm')?.addEventListener('submit', handleRegister);
$('googleBtn')?.addEventListener('click', handleGoogle);
$('skipAuth')?.addEventListener('click', skipAuth);

// initial
switchAuthTab('login');
