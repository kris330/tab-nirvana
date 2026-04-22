// ──────────────────────────────────────────────
// TabNirvana — Summary Page
// ──────────────────────────────────────────────

'use strict';

// ═══════════════════════════════════════════════
// AUDIO — 8-bit 游戏撒金币音效
// ═══════════════════════════════════════════════
let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new AudioContext();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function _playSingleCoin(ctx, delay) {
  const t = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.connect(env); env.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(1567.98, t);
  osc.frequency.setValueAtTime(2093.00, t + 0.05);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(0.25, t + 0.004);
  env.gain.setValueAtTime(0.25, t + 0.05);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.start(t); osc.stop(t + 0.18);

  const shimmer = ctx.createOscillator();
  const shimEnv = ctx.createGain();
  shimmer.connect(shimEnv); shimEnv.connect(ctx.destination);
  shimmer.type = 'sine';
  shimmer.frequency.setValueAtTime(4186.00, t + 0.02);
  shimmer.frequency.exponentialRampToValueAtTime(3135.96, t + 0.12);
  shimEnv.gain.setValueAtTime(0.09, t + 0.02);
  shimEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  shimmer.start(t + 0.02); shimmer.stop(t + 0.14);
}

function playCoinSound(coinCount = 1) {
  const ctx = getAudioCtx();
  const n = Math.min(Math.max(coinCount, 1), 8);
  for (let i = 0; i < n; i++) {
    _playSingleCoin(ctx, i * 0.045 + Math.random() * 0.015);
  }
}

// ═══════════════════════════════════════════════
// COIN ANIMATION
// ═══════════════════════════════════════════════
const COIN_SYMBOLS = ['$', '¥', '€', '✦', '★'];

function spawnCoins(cx, cy, count = 8) {
  for (let i = 0; i < count; i++) {
    const coin = document.createElement('div');
    coin.className = 'coin';
    coin.textContent = COIN_SYMBOLS[i % COIN_SYMBOLS.length];
    const angleDeg = Math.random() * 300 - 150;
    const angleRad = angleDeg * (Math.PI / 180);
    const speed = 70 + Math.random() * 110;
    coin.style.left = `${cx}px`;
    coin.style.top  = `${cy}px`;
    coin.style.setProperty('--tx', `${Math.cos(angleRad) * speed}px`);
    coin.style.setProperty('--ty', `${-Math.abs(Math.sin(angleRad) * speed) - 10}px`);
    coin.style.animationDelay    = `${i * 28}ms`;
    coin.style.animationDuration = `${480 + Math.random() * 220}ms`;
    document.body.appendChild(coin);
    coin.addEventListener('animationend', () => coin.remove(), { once: true });
  }
}

function burstFrom(el, count) {
  const r = el.getBoundingClientRect();
  spawnCoins(r.left + r.width / 2, r.top + r.height / 2, count);
}

// ═══════════════════════════════════════════════
// DOMAIN COLOUR
// ═══════════════════════════════════════════════
const PALETTE = [
  '#6366f1', '#06b6d4', '#10b981', '#f59e0b',
  '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6',
  '#f97316', '#3b82f6',
];

function domainColor(domain) {
  let h = 0;
  for (const ch of domain) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function colorWithAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// ═══════════════════════════════════════════════
// HOVER PREVIEW CARD
// ═══════════════════════════════════════════════
const _hoverCard = document.createElement('div');
_hoverCard.id = 'tab-hover-card';
document.body.appendChild(_hoverCard);

let _hoverShowTimer = null;
let _hoverHideTimer = null;
let _hoverGen = 0;                        // cancels stale fetch responses
const _previewCache = new Map();          // url → html string (session cache)

function showHoverCard(tab, meta, anchorEl) {
  clearTimeout(_hoverHideTimer);
  clearTimeout(_hoverShowTimer);
  _hoverShowTimer = setTimeout(() => {
    _positionCard(anchorEl);
    _renderLoading(tab);
    _fetchAndRender(tab, meta);
  }, 280);
}

function hideHoverCard() {
  clearTimeout(_hoverShowTimer);
  _hoverGen++;                            // invalidate any in-flight fetch
  _hoverHideTimer = setTimeout(() => {
    _hoverCard.classList.remove('visible');
  }, 120);
}

/** Position the card to the right of the anchor (or left if near viewport edge) */
function _positionCard(anchorEl) {
  const rect   = anchorEl.getBoundingClientRect();
  const cardW  = 320;
  const cardH  = 260; // preview 200 + footer ~60
  const gap    = 12;
  const left   = (window.innerWidth - rect.right - gap >= cardW)
    ? rect.right + gap
    : rect.left - cardW - gap;
  const top    = Math.min(rect.top, window.innerHeight - cardH - 8);
  _hoverCard.style.left = `${Math.max(4, left)}px`;
  _hoverCard.style.top  = `${Math.max(4, top)}px`;
}

/** Show spinner + title/url while fetch is in progress */
function _renderLoading(tab) {
  _hoverCard.innerHTML = `
    <div class="hc-preview">
      <div class="hc-loading"><div class="spinner"></div></div>
    </div>
    <div class="hc-footer">
      <div class="hc-title">${escHtml(tab.title || tab.url || '')}</div>
      <div class="hc-url">${escHtml(tab.url || '')}</div>
    </div>`;
  _hoverCard.classList.add('visible');
}

/** Fetch HTML (cached), then render iframe or fall back to OG image */
async function _fetchAndRender(tab, meta) {
  const gen = ++_hoverGen;
  const url = tab.url;

  let html = _previewCache.get(url) ?? null;

  if (!html) {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'FETCH_PREVIEW', url });
      if (gen !== _hoverGen) return;          // user moved away
      if (res?.ok && res.html) {
        html = res.html;
        _previewCache.set(url, html);
      }
    } catch (_) { /* ignore */ }
  }

  if (gen !== _hoverGen) return;

  const preview = _hoverCard.querySelector('.hc-preview');
  if (!preview) return;

  if (html) {
    _renderIframe(preview, html, url);
  } else {
    _renderFallback(preview, meta);
  }
}

/** Inject <base> so relative paths resolve, then load in sandboxed iframe */
function _renderIframe(preview, html, url) {
  // Inject <base href> right after <head> (or prepend if no head tag)
  const baseTag = `<base href="${escAttr(url)}">`;
  const patched = /<head/i.test(html)
    ? html.replace(/(<head[^>]*>)/i, `$1${baseTag}`)
    : baseTag + html;

  const iframe = document.createElement('iframe');
  // allow-same-origin lets stylesheets/images load; scripts remain blocked
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.className = 'hc-iframe';
  iframe.srcdoc = patched;

  preview.innerHTML = '';
  preview.appendChild(iframe);
}

/** Fall back to OG image, then plain "no preview" text */
function _renderFallback(preview, meta) {
  const ogImage = meta?.ogImage || '';
  if (ogImage) {
    const img = document.createElement('img');
    img.className = 'hc-image';
    img.alt = '';
    img.src = ogImage;
    img.addEventListener('error', () => {
      preview.innerHTML = '<div class="hc-no-preview">No preview available</div>';
    }, { once: true });
    preview.innerHTML = '';
    preview.appendChild(img);
  } else {
    preview.innerHTML = '<div class="hc-no-preview">No preview available</div>';
  }
}

// ═══════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════
/** @type {Map<string, object[]>} domain → tabs[] */
let tabGroups = new Map();
let windowId  = null;   // 当前窗口 ID，用于 win-badge 对比
let selfTabId = null;

/** windowId → 'W2'/'W3'/... 标签，当前窗口不记录 */
const windowLabels = new Map();

/** 悬停预览开关，默认关闭 */
let hoverPreviewEnabled = false;

// ── 功能4：重复 URL 集合 ──────────────────────
/** @type {Set<string>} 出现 2+ 次的 tab URL */
let dupeUrls = new Set();

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
async function init() {
  // 获取当前标签/窗口信息（modal 模式下 getCurrent 可能返回 null，graceful 处理）
  try {
    const self = await chrome.tabs.getCurrent();
    if (self) { selfTabId = self.id; windowId = self.windowId; }
  } catch (_) {}

  if (!windowId) {
    try { const win = await chrome.windows.getCurrent(); windowId = win.id; } catch (_) {}
  }

  // 构建多窗口标签（W2、W3…），当前窗口不记录
  try {
    const wins = await chrome.windows.getAll();
    wins.sort((a, b) => (a.id === windowId ? -1 : b.id === windowId ? 1 : a.id - b.id));
    wins.forEach((w, i) => { if (w.id !== windowId) windowLabels.set(w.id, `W${i + 1}`); });
  } catch (_) {}

  // 加载悬停预览开关偏好
  try {
    const stored = await chrome.storage.local.get('hoverPreviewEnabled');
    hoverPreviewEnabled = stored.hoverPreviewEnabled ?? false;
    document.getElementById('hover-toggle').checked = hoverPreviewEnabled;
  } catch (_) {}

  await loadTabs();
  bindCloseAll();
  bindSearch();
  bindHoverToggle();
  bindRealtimeSync();
  bindKeyboardNav();
  // Auto-focus search input when the panel opens
  setTimeout(() => document.getElementById('search-input')?.focus(), 80);
}

// ═══════════════════════════════════════════════
// LOAD TABS
// ═══════════════════════════════════════════════
async function loadTabs() {
  const allTabs = await chrome.tabs.query({}); // 所有窗口

  const tabs = allTabs.filter(t =>
    t.id !== selfTabId && t.url &&
    !t.url.startsWith('chrome-extension://') &&
    !t.url.startsWith('chrome://') &&
    !t.url.startsWith('about:') &&
    !t.url.startsWith('edge://'),
  );

  let metadataMap = {};
  try {
    const res = await Promise.race([
      chrome.runtime.sendMessage({ type: 'GET_TAB_METADATA' }),
      new Promise(resolve => setTimeout(() => resolve(null), 1500)),
    ]);
    metadataMap = res?.metadata ?? {};
  } catch (_) {}

  tabGroups.clear();
  for (const tab of tabs) {
    const domain = safeDomain(tab.url);
    if (!tabGroups.has(domain)) tabGroups.set(domain, []);
    tabGroups.get(domain).push({ ...tab, metadata: metadataMap[tab.id] ?? null });
  }

  computeDupeUrls();
  render();
}

function safeDomain(url) {
  try { return new URL(url).hostname || url; }
  catch { return url || 'unknown'; }
}

// ═══════════════════════════════════════════════
// 功能4：DUPLICATE DETECTION
// ═══════════════════════════════════════════════
function computeDupeUrls() {
  const counts = new Map();
  for (const tabs of tabGroups.values()) {
    for (const tab of tabs) {
      if (tab.url) counts.set(tab.url, (counts.get(tab.url) ?? 0) + 1);
    }
  }
  dupeUrls = new Set([...counts].filter(([, n]) => n > 1).map(([u]) => u));
}

/** 重算重复并刷新页面上所有 dup-badge */
function refreshDupeBadges() {
  computeDupeUrls();
  document.querySelectorAll('.tab-item').forEach(li => {
    const tabId = parseInt(li.dataset.tabId, 10);
    const tab   = findTabById(tabId);
    if (!tab) return;

    const existing = li.querySelector('.dup-badge');
    const isDupe   = dupeUrls.has(tab.url);
    const count    = isDupe ? countUrl(tab.url) : 0;

    if (isDupe) {
      if (existing) {
        existing.textContent = `×${count}`;
      } else {
        const badge = document.createElement('span');
        badge.className   = 'dup-badge';
        badge.title       = `This URL is open in ${count} tabs`;
        badge.textContent = `×${count}`;
        li.querySelector('.tab-title')?.after(badge);
      }
    } else {
      existing?.remove();
    }
  });
}

function countUrl(url) {
  let n = 0;
  for (const tabs of tabGroups.values()) n += tabs.filter(t => t.url === url).length;
  return n;
}

function findTabById(tabId) {
  for (const tabs of tabGroups.values()) {
    const t = tabs.find(t => t.id === tabId);
    if (t) return t;
  }
  return null;
}

function findDomainByTabId(tabId) {
  for (const [domain, tabs] of tabGroups) {
    if (tabs.some(t => t.id === tabId)) return domain;
  }
  return null;
}

// ═══════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════
function render() {
  const masonry = document.getElementById('masonry');
  document.getElementById('loading').hidden = true;
  refreshStats();

  if (tabGroups.size === 0) {
    masonry.hidden = true;
    document.getElementById('empty-state').hidden = false;
    return;
  }

  masonry.hidden = false;
  document.getElementById('empty-state').hidden = true;
  masonry.innerHTML = '';

  let delay = 0;
  for (const [domain, tabs] of tabGroups) {
    masonry.appendChild(buildCard(domain, tabs, delay));
    delay += 55;
  }
}

function refreshStats() {
  const total   = [...tabGroups.values()].reduce((n, t) => n + t.length, 0);
  const domains = tabGroups.size;
  const winCount = new Set([...tabGroups.values()].flat().map(t => t.windowId)).size;
  let text = `${total} tab${total !== 1 ? 's' : ''} · ${domains} domain${domains !== 1 ? 's' : ''}`;
  if (winCount > 1) text += ` · ${winCount} windows`;
  document.getElementById('header-stats').textContent = text;
}

// ═══════════════════════════════════════════════
// BUILD DOMAIN CARD
// ═══════════════════════════════════════════════
function buildCard(domain, tabs, animDelay = 0) {
  const color   = domainColor(domain);
  const cardBg  = colorWithAlpha(color, 0.06);
  const badgeBg = colorWithAlpha(color, 0.12);

  const card = document.createElement('div');
  card.className = 'domain-card';
  card.dataset.domain = domain;
  card.style.animationDelay = `${animDelay}ms`;
  card.style.setProperty('--domain-color', color);
  card.style.background  = cardBg;
  card.style.borderColor = colorWithAlpha(color, 0.22);

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <div class="domain-info">
      <img class="domain-favicon" alt="" loading="lazy">
      <span class="domain-name" title="${escHtml(domain)}">${escHtml(domain)}</span>
      <span class="tab-badge" style="background:${badgeBg}; color:${color}">${tabs.length}</span>
    </div>
    <button class="close-group-btn" title="Close all ${escHtml(domain)} tabs">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
      Close all
    </button>
  `;

  const fav = header.querySelector('.domain-favicon');
  fav.src = `https://${domain}/favicon.ico`;
  fav.addEventListener('error', () => { fav.style.visibility = 'hidden'; });

  const list = document.createElement('ul');
  list.className = 'tab-list';
  for (const tab of tabs) list.appendChild(buildTabItem(tab, domain, card));

  card.appendChild(header);
  card.appendChild(list);

  header.querySelector('.close-group-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const tabIds = tabGroups.get(domain)?.map(t => t.id) ?? [];
    playCoinSound(tabIds.length);
    burstFrom(e.currentTarget, Math.min(tabIds.length * 4, 24));
    await animateCardOut(card);
    await chrome.tabs.remove(tabIds).catch(() => {});
    tabGroups.delete(domain);
    card.remove();
    refreshStats();
    refreshDupeBadges();
    checkEmpty();
  });

  return card;
}

// ═══════════════════════════════════════════════
// BUILD TAB ITEM
// ═══════════════════════════════════════════════
const FALLBACK_FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">' +
  '<rect width="16" height="16" rx="4" fill="#e2e8f0"/></svg>',
);

function buildTabItem(tab, domain, card) {
  const meta    = tab.metadata ?? {};
  const preview = meta.description || meta.snippet || meta.heading || '';
  // 只接受安全来源的 favIconUrl（https: 或 data:），
  // http:// 图标从 chrome-extension 页面加载会触发 Mixed Content 拦截
  const safeFav = tab.favIconUrl && !tab.favIconUrl.startsWith('http:')
    ? tab.favIconUrl : null;
  const favicon = safeFav || `https://${domain}/favicon.ico`;
  const ogImage = meta.ogImage || '';
  const isDupe  = dupeUrls.has(tab.url);
  const dupeCount = isDupe ? countUrl(tab.url) : 0;
  const winLabel = windowLabels.get(tab.windowId); // 非当前窗口才有标签

  const li = document.createElement('li');
  li.className = 'tab-item';
  li.dataset.tabId  = tab.id;
  li.dataset.url    = tab.url ?? '';
  li.style.maxHeight = '200px';

  li.innerHTML = `
    <div class="tab-main" role="button" tabindex="0">
      <img class="tab-favicon" alt="" loading="lazy">
      <div class="tab-info">
        <div class="tab-title-row">
          <span class="tab-title" title="${escAttr(tab.title || tab.url)}">${escHtml(tab.title || tab.url)}</span>
          ${isDupe ? `<span class="dup-badge" title="Open in ${dupeCount} tabs">×${dupeCount}</span>` : ''}
          ${winLabel ? `<span class="win-badge" title="In another window">${escHtml(winLabel)}</span>` : ''}
        </div>
        ${preview ? `<div class="tab-preview">${escHtml(preview)}</div>` : ''}
      </div>
      ${ogImage ? `<img class="tab-thumb" alt="" loading="lazy">` : ''}
    </div>
    <button class="close-tab-btn" title="Close this tab" aria-label="Close ${escAttr(tab.title)}">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>
  `;

  const favImg = li.querySelector('.tab-favicon');
  favImg.src = favicon;
  favImg.addEventListener('error', () => { favImg.src = FALLBACK_FAVICON; });

  if (ogImage) {
    const thumb = li.querySelector('.tab-thumb');
    thumb.src = ogImage;
    thumb.addEventListener('error', () => { thumb.remove(); });
  }

  const tabMain = li.querySelector('.tab-main');
  tabMain.addEventListener('click', () => activateTab(tab));
  tabMain.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateTab(tab); }
  });
  tabMain.addEventListener('mouseenter', () => { if (hoverPreviewEnabled) showHoverCard(tab, meta, li); });
  tabMain.addEventListener('mouseleave', () => { if (hoverPreviewEnabled) hideHoverCard(); });

  li.querySelector('.close-tab-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    playCoinSound(1);
    burstFrom(e.currentTarget, 7);
    await animateRowOut(li);
    await chrome.tabs.remove(tab.id).catch(() => {});
    removeFromState(tab.id, domain, card);
    refreshStats();
    refreshDupeBadges();
    checkEmpty();
  });

  return li;
}

// ═══════════════════════════════════════════════
// 功能1：REAL-TIME SYNC
// 监听当前窗口的标签变化，即时更新 UI
// ═══════════════════════════════════════════════
function bindRealtimeSync() {
  // ── Tab removed externally (e.g. user closed via Cmd+W) ──
  chrome.tabs.onRemoved.addListener((tabId, _info) => {
    const domain = findDomainByTabId(tabId);
    if (!domain) return;
    const card = document.querySelector(`.domain-card[data-domain="${CSS.escape(domain)}"]`);
    const li   = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    if (!li) return;

    animateRowOut(li).then(() => {
      removeFromState(tabId, domain, card);
      refreshStats();
      refreshDupeBadges();
      checkEmpty();
    });
  });

  // ── New tab opened ──
  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id === selfTabId) return;
    // Wait briefly for URL/title to populate, then add
    setTimeout(() => {
      chrome.tabs.get(tab.id, (freshTab) => {
        if (chrome.runtime.lastError || !freshTab?.url) return;
        if (freshTab.url.startsWith('chrome://') ||
            freshTab.url.startsWith('chrome-extension://') ||
            freshTab.url.startsWith('about:')) return;
        addTabToUI(freshTab);
      });
    }, 400);
  });

  // ── Tab navigated / title updated ──
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tabId === selfTabId) return;
    if (changeInfo.status === 'complete') {
      updateTabInUI(tab);
    } else if (changeInfo.title || changeInfo.favIconUrl) {
      patchTabInUI(tabId, changeInfo);
    }
  });
}

/** Add a newly-opened tab to the UI without full re-render */
function addTabToUI(tab) {
  // Dedup guard: skip if this tab is already in the UI
  if (findTabById(tab.id)) return;

  const domain = safeDomain(tab.url);
  const enriched = { ...tab, metadata: null };

  if (!tabGroups.has(domain)) {
    // New domain — create new card
    tabGroups.set(domain, [enriched]);
    computeDupeUrls();
    const masonry = document.getElementById('masonry');
    const card = buildCard(domain, tabGroups.get(domain), 0);
    card.style.opacity   = '0';
    card.style.transform = 'scale(.96)';
    masonry.appendChild(card);
    masonry.hidden = false;
    document.getElementById('empty-state').hidden = true;
    requestAnimationFrame(() => {
      card.style.transition = 'opacity .25s ease, transform .25s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'scale(1)';
    });
  } else {
    // Existing domain — append row
    tabGroups.get(domain).push(enriched);
    computeDupeUrls();
    const card = document.querySelector(`.domain-card[data-domain="${CSS.escape(domain)}"]`);
    if (!card) return;
    const li = buildTabItem(enriched, domain, card);
    li.classList.add('tab-new');
    card.querySelector('.tab-list').appendChild(li);
    const badge = card.querySelector('.tab-badge');
    if (badge) badge.textContent = tabGroups.get(domain).length;
  }

  refreshStats();
  refreshDupeBadges();
  applyCurrentSearch();
}

/** When a tab finishes loading in a new URL (navigation), re-add or update it */
function updateTabInUI(tab) {
  const existingLi = document.querySelector(`.tab-item[data-tab-id="${tab.id}"]`);

  if (!existingLi) {
    // Tab not currently shown (might have been filtered or newly qualifying)
    addTabToUI(tab);
    return;
  }

  const oldDomain = existingLi.closest('.domain-card')?.dataset.domain;
  const newDomain = safeDomain(tab.url);

  if (oldDomain && oldDomain !== newDomain) {
    // Domain changed — remove from old, add to new
    const oldCard = document.querySelector(`.domain-card[data-domain="${CSS.escape(oldDomain)}"]`);
    animateRowOut(existingLi).then(() => {
      removeFromState(tab.id, oldDomain, oldCard);
      addTabToUI(tab);
    });
  } else {
    // Same domain — just patch the row
    patchTabInUI(tab.id, { title: tab.title, favIconUrl: tab.favIconUrl, url: tab.url });
    // Update stored data
    const group = tabGroups.get(newDomain);
    if (group) {
      const idx = group.findIndex(t => t.id === tab.id);
      if (idx !== -1) Object.assign(group[idx], tab);
    }
  }
}

/** Patch just the visible parts of a tab row (title / favicon) */
function patchTabInUI(tabId, changes) {
  const li = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
  if (!li) return;
  if (changes.title) {
    const el = li.querySelector('.tab-title');
    if (el) el.textContent = changes.title;
  }
  if (changes.favIconUrl) {
    const img = li.querySelector('.tab-favicon');
    if (img) img.src = changes.favIconUrl;
  }
}

// ═══════════════════════════════════════════════
// 功能3：SEARCH
// ═══════════════════════════════════════════════
function bindSearch() {
  const input    = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');

  function syncClearBtn() {
    clearBtn.hidden = !input.value;
  }

  function clearSearch() {
    input.value = '';
    syncClearBtn();
    applyCurrentSearch();
    input.focus();
  }

  input.addEventListener('input', () => {
    syncClearBtn();
    applyCurrentSearch();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (input.value) {
      clearSearch();          // first ESC: clear search
    } else {
      window.parent.postMessage({ type: 'TN_CLOSE_MODAL' }, '*'); // second ESC: close modal
    }
  });

  clearBtn.addEventListener('click', clearSearch);
}

function applyCurrentSearch() {
  const q = document.getElementById('search-input').value.toLowerCase().trim();
  const countEl = document.getElementById('search-count');
  let matchCount = 0;

  for (const [domain, tabs] of tabGroups) {
    const card = document.querySelector(`.domain-card[data-domain="${CSS.escape(domain)}"]`);
    if (!card) continue;

    let cardMatches = 0;
    const items = card.querySelectorAll('.tab-item');

    items.forEach((li) => {
      const tabId = parseInt(li.dataset.tabId, 10);
      const tab   = findTabById(tabId);
      if (!tab) return;

      const haystack = [
        tab.title ?? '',
        tab.url   ?? '',
        domain,
        tab.metadata?.description ?? '',
        tab.metadata?.snippet     ?? '',
        tab.metadata?.heading     ?? '',
      ].join(' ').toLowerCase();

      const matches = !q || haystack.includes(q);
      li.classList.toggle('search-hidden', !matches);
      if (matches) { cardMatches++; matchCount++; }
    });

    card.classList.toggle('search-hidden', cardMatches === 0);

    // Update badge to show matching count when searching
    const badge = card.querySelector('.tab-badge');
    if (badge) badge.textContent = q ? cardMatches : tabs.length;
  }

  // Show match count when query is active
  if (q) {
    countEl.textContent = matchCount.toString();
    countEl.hidden = false;
  } else {
    countEl.hidden = true;
  }
}

// ═══════════════════════════════════════════════
// 键盘导航
// ═══════════════════════════════════════════════
function bindKeyboardNav() {
  function visibleItems() {
    return [...document.querySelectorAll(
      '#masonry .tab-item:not(.search-hidden):not(.removing)'
    )];
  }

  function getKbdItem() {
    return document.querySelector('.tab-item.kbd-focus');
  }

  function setKbdFocus(el) {
    getKbdItem()?.classList.remove('kbd-focus');
    if (!el) return;
    el.classList.add('kbd-focus');
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /**
   * Find the visually nearest tab item to the left or right of `current`.
   * Uses getBoundingClientRect so it works with any column layout.
   * Scoring: vertical proximity is the primary factor; horizontal distance
   * is a small tiebreaker so items in the same visual row win.
   */
  function nearestInDirection(current, dir) {
    const items = visibleItems();
    const cr = current.getBoundingClientRect();
    const cCX = cr.left + cr.width  / 2;
    const cCY = cr.top  + cr.height / 2;

    let best = null;
    let bestScore = Infinity;

    for (const item of items) {
      if (item === current) continue;
      const r = item.getBoundingClientRect();
      const iCX = r.left + r.width  / 2;
      const iCY = r.top  + r.height / 2;

      if (dir === 'right' && iCX <= cCX) continue;
      if (dir === 'left'  && iCX >= cCX) continue;

      const dy = Math.abs(iCY - cCY);
      const dx = Math.abs(iCX - cCX);
      const score = dy + dx * 0.1; // vertical proximity dominates

      if (score < bestScore) { bestScore = score; best = item; }
    }
    return best;
  }

  document.addEventListener('keydown', (e) => {
    const inSearch = document.activeElement?.id === 'search-input';

    // '/' → jump to search box from anywhere in the grid
    if (e.key === '/' && !inSearch) {
      e.preventDefault();
      setKbdFocus(null);
      document.getElementById('search-input').focus();
      return;
    }

    // While search box is focused, only ↓ moves into the grid
    if (inSearch) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        document.activeElement.blur();
        const items = visibleItems();
        if (items.length) setKbdFocus(items[0]);
      }
      return;
    }

    const items   = visibleItems();
    const current = getKbdItem();
    const idx     = current ? items.indexOf(current) : -1;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (idx === -1 && items.length) { setKbdFocus(items[0]); break; }
        if (idx < items.length - 1) setKbdFocus(items[idx + 1]);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (idx <= 0) {
          setKbdFocus(null);
          document.getElementById('search-input').focus();
        } else {
          setKbdFocus(items[idx - 1]);
        }
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        if (!current) { if (items.length) setKbdFocus(items[0]); break; }
        const target = nearestInDirection(current, 'right');
        if (target) setKbdFocus(target);
        break;
      }
      case 'ArrowLeft': {
        e.preventDefault();
        if (!current) break;
        const target = nearestInDirection(current, 'left');
        if (target) setKbdFocus(target);
        break;
      }
      case 'Enter': {
        if (!current) break;
        e.preventDefault();
        current.querySelector('.tab-main')?.click();
        break;
      }
      case 'Delete':
      case 'Backspace': {
        if (!current) break;
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Delete → close all tabs in the current domain card
          current.closest('.domain-card')?.querySelector('.close-group-btn')?.click();
        } else {
          // Delete → close single tab, then move focus to adjacent item
          const nextIdx = idx < items.length - 1 ? idx + 1 : idx - 1;
          current.querySelector('.close-tab-btn')?.click();
          if (nextIdx >= 0) {
            setTimeout(() => {
              const newItems = visibleItems();
              const next = newItems[Math.min(nextIdx, newItems.length - 1)];
              if (next) setKbdFocus(next);
            }, 260);
          }
        }
        break;
      }
    }
  });

  // Clear keyboard highlight when the mouse moves (user switched back to mouse)
  document.getElementById('masonry')?.addEventListener('mousemove', () => {
    getKbdItem()?.classList.remove('kbd-focus');
  }, { passive: true });
}

// ═══════════════════════════════════════════════
// 悬停预览开关
// ═══════════════════════════════════════════════
function bindHoverToggle() {
  const toggle = document.getElementById('hover-toggle');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    hoverPreviewEnabled = toggle.checked;
    if (!hoverPreviewEnabled) hideHoverCard();
    chrome.storage.local.set({ hoverPreviewEnabled }).catch(() => {});
  });
}

// ═══════════════════════════════════════════════
// CLOSE ALL
// ═══════════════════════════════════════════════
function bindCloseAll() {
  document.getElementById('close-all-btn').addEventListener('click', async (e) => {
    const allTabIds = [...tabGroups.values()].flatMap(tabs => tabs.map(t => t.id));
    if (allTabIds.length === 0) return;

    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    playCoinSound(Math.min(allTabIds.length, 12));
    spawnCoins(cx, cy, 18);
    setTimeout(() => spawnCoins(cx + 20, cy + 10, 14), 100);
    setTimeout(() => spawnCoins(cx - 15, cy - 5,  12), 200);

    const cards = [...document.querySelectorAll('.domain-card')];
    cards.forEach((card, i) => setTimeout(() => animateCardOut(card), i * 60));

    await sleep(cards.length * 60 + 320);
    await chrome.tabs.remove(allTabIds).catch(() => {});
    tabGroups.clear();
    document.getElementById('masonry').innerHTML = '';
    checkEmpty();
    refreshStats();
  });
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function activateTab(tab) {
  chrome.tabs.update(tab.id, { active: true }).catch(() => {});
  chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  // If the target tab already has a TabNirvana modal open, close it
  chrome.tabs.sendMessage(tab.id, { type: 'CLOSE_MODAL' }).catch(() => {});
}

/** Remove a tab from the in-memory state and update the card */
function removeFromState(tabId, domain, card) {
  const group = tabGroups.get(domain);
  if (!group) return;
  const idx = group.findIndex(t => t.id === tabId);
  if (idx !== -1) group.splice(idx, 1);

  const li = document.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
  li?.remove();

  if (group.length === 0) {
    tabGroups.delete(domain);
    card?.remove();
  } else {
    const badge = card?.querySelector('.tab-badge');
    if (badge) badge.textContent = group.length;
  }
}

function animateRowOut(li) {
  return new Promise(resolve => {
    li.style.maxHeight = li.offsetHeight + 'px';
    requestAnimationFrame(() => {
      li.style.transition = 'max-height .22s ease, opacity .18s ease, transform .18s ease';
      li.style.maxHeight  = '0';
      li.style.opacity    = '0';
      li.style.transform  = 'translateX(14px)';
      setTimeout(resolve, 220);
    });
  });
}

function animateCardOut(card) {
  return new Promise(resolve => {
    card.style.transition = 'transform .28s ease, opacity .28s ease';
    card.style.transform  = 'scale(.9) translateY(-8px)';
    card.style.opacity    = '0';
    setTimeout(resolve, 280);
  });
}

function checkEmpty() {
  const total = [...tabGroups.values()].reduce((n, t) => n + t.length, 0);
  if (total === 0) {
    document.getElementById('masonry').hidden = true;
    document.getElementById('empty-state').hidden = false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function escAttr(str) { return String(str ?? '').replace(/"/g, '&quot;'); }

// ═══════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════
init().catch(err => {
  console.error('[TabNirvana] init error:', err);
  document.getElementById('loading').innerHTML =
    `<p style="color:#ef4444">Failed to load tabs. Please reload.</p>`;
});
