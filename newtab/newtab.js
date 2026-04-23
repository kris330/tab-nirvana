'use strict';

// ── Clock ─────────────────────────────────────
const clockEl = document.getElementById('clock');
const dateEl  = document.getElementById('date');

const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function updateClock() {
  const now = new Date();
  const h   = now.getHours().toString().padStart(2, '0');
  const m   = now.getMinutes().toString().padStart(2, '0');
  clockEl.textContent = `${h}:${m}`;
  dateEl.textContent  =
    `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`;
}

updateClock();
setInterval(updateClock, 1000);

// ── Modal (same logic as floating-btn.js, without the FAB) ────────────────
const MODAL_ID = '__tn-modal__';

function openModal() {
  if (document.getElementById(MODAL_ID)) return;

  const overlay = document.createElement('div');
  overlay.id = MODAL_ID;

  const backdrop = document.createElement('div');
  backdrop.className = '__tn-backdrop__';

  const container = document.createElement('div');
  container.className = '__tn-container__';

  const closeBtn = document.createElement('button');
  closeBtn.className = '__tn-close__';
  closeBtn.setAttribute('aria-label', 'Close TabNirvana');
  closeBtn.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M18 6L6 18M6 6l12 12"/></svg>';

  const iframe = document.createElement('iframe');
  iframe.className = '__tn-iframe__';
  iframe.src = chrome.runtime.getURL('summary/index.html');

  container.appendChild(closeBtn);
  container.appendChild(iframe);
  overlay.appendChild(backdrop);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', onEsc);
  document.documentElement.style.overflow = 'hidden';

  requestAnimationFrame(() => overlay.classList.add('__tn-visible__'));
}

function closeModal() {
  const overlay = document.getElementById(MODAL_ID);
  if (!overlay) return;
  document.removeEventListener('keydown', onEsc);
  document.documentElement.style.overflow = '';
  overlay.classList.remove('__tn-visible__');
  setTimeout(() => overlay.remove(), 220);
}

function onEsc(e) {
  if (e.key === 'Escape') closeModal();
}

// ── Wire up the button ────────────────────────
document.getElementById('open-btn').addEventListener('click', openModal);

// ── Listen for OPEN_MODAL from background.js ─
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'OPEN_MODAL')  openModal();
  if (message.type === 'CLOSE_MODAL') closeModal();
});

// ── Listen for ESC/close posted by the iframe ─
window.addEventListener('message', (e) => {
  if (e.data?.type === 'TN_CLOSE_MODAL') closeModal();
});
