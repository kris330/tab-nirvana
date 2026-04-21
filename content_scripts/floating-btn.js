// ──────────────────────────────────────────────
// TabNirvana — Floating Button
// 单击 → 打开 Summary
// 拖拽 → 自由定位，靠近右边缘时自动吸附回边缘
// 位置持久化至 chrome.storage.local
// ──────────────────────────────────────────────
(function () {
  if (document.getElementById('__tab-nirvana-fab__')) return;

  const POS_KEY      = 'fabPosition';
  const DRAG_PX      = 5;   // 超过这个距离才算拖拽
  const SNAP_EDGE_PX = 60;  // 距右边缘 60px 内松手 → 吸附回边缘

  let dragging   = false;
  let startMouseX = 0, startMouseY = 0;
  let startBtnLeft = 0, startBtnTop = 0;

  // ── 创建按钮 ──────────────────────────────────
  const btn = document.createElement('button');
  btn.id = '__tab-nirvana-fab__';
  btn.setAttribute('aria-label', 'Open TabNirvana tab manager');
  btn.title = 'TabNirvana — click to open · drag to reposition';

  btn.innerHTML = `
    <svg class="tn-icon" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5"
         stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2.5"/>
      <path d="M8 21h8"/><path d="M12 17v4"/>
    </svg>
    <span class="tn-label">Nirvana</span>
  `;

  document.body.appendChild(btn);

  // ── 恢复上次保存的位置 ────────────────────────
  try {
    chrome.storage.local.get(POS_KEY, (res) => {
      const pos = res?.[POS_KEY];
      if (!pos) return;

      if (pos.mode === 'free') {
        // 自由位置：clamp 防止窗口尺寸变化后溢出屏幕
        const maxLeft = window.innerWidth  - btn.offsetWidth  - 4;
        const maxTop  = window.innerHeight - btn.offsetHeight - 4;
        const left = Math.max(0, Math.min(parseFloat(pos.left), maxLeft));
        const top  = Math.max(0, Math.min(parseFloat(pos.top),  maxTop));
        enterFreeMode(left, top);
      } else {
        // 'right' 模式：只恢复垂直位置，保持原始右边缘贴合
        if (pos.top) {
          btn.style.setProperty('top',       pos.top, 'important');
          btn.style.setProperty('transform', 'none',  'important');
        }
      }
    });
  } catch (_) {}

  // ── 拖拽 mousedown ────────────────────────────
  btn.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    dragging     = false;
    startMouseX  = e.clientX;
    startMouseY  = e.clientY;

    const rect   = btn.getBoundingClientRect();
    startBtnLeft = rect.left;
    startBtnTop  = rect.top;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp, { once: true });
  });

  function onMouseMove(e) {
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;

    // 超过阈值才切换为拖拽模式，避免点击误触发
    if (!dragging && Math.hypot(dx, dy) > DRAG_PX) {
      dragging = true;
      btn.classList.add('tn-dragging');
      enterFreeMode(startBtnLeft, startBtnTop);
    }

    if (!dragging) return;

    const W  = window.innerWidth;
    const H  = window.innerHeight;
    const bw = btn.offsetWidth;
    const bh = btn.offsetHeight;

    const newLeft = Math.max(0, Math.min(startBtnLeft + dx, W - bw));
    const newTop  = Math.max(0, Math.min(startBtnTop  + dy, H - bh));

    // 必须用 setProperty + 'important'，否则 CSS 里的
    // top: 50% !important 会覆盖普通内联样式，导致垂直方向锁死
    btn.style.setProperty('left', newLeft + 'px', 'important');
    btn.style.setProperty('top',  newTop  + 'px', 'important');
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    btn.classList.remove('tn-dragging');

    if (!dragging) {
      // 纯点击
      handleClick();
      return;
    }

    dragging = false;

    // ── 吸附逻辑 ──
    const rect      = btn.getBoundingClientRect();
    const distRight = window.innerWidth - rect.right;

    if (distRight <= SNAP_EDGE_PX) {
      // 靠近右边缘 → 吸附回右边缘
      exitFreeMode(rect.top);
      savePos({ mode: 'right', top: rect.top + 'px' });
    } else {
      // 自由放置
      savePos({ mode: 'free', left: btn.style.left, top: btn.style.top });
    }
  }

  // ── 切换布局模式 ──────────────────────────────
  /** 切换为自由浮动（left/top 定位） */
  function enterFreeMode(left, top) {
    btn.classList.add('tn-free');
    // 用 !important 覆盖 CSS 里的 top:50%!important / transform:translateY(-50%)!important
    btn.style.setProperty('left',      left + 'px', 'important');
    btn.style.setProperty('top',       top  + 'px', 'important');
    btn.style.setProperty('transform', 'none',       'important');
  }

  /** 吸附回右边缘（恢复 right 定位） */
  function exitFreeMode(currentTop) {
    btn.classList.remove('tn-free');
    btn.style.left = '';
    btn.style.setProperty('top',       currentTop + 'px', 'important');
    btn.style.setProperty('transform', 'none',             'important');
    // 用 requestAnimationFrame 让浏览器先渲染 tn-free 移除再加过渡
    requestAnimationFrame(() => {
      btn.style.transition = 'right 0.3s cubic-bezier(0.34,1.56,0.64,1), top 0.2s ease';
      btn.style.setProperty('top', currentTop + 'px', 'important');
    });
  }

  // ── 持久化 ───────────────────────────────────
  function savePos(pos) {
    try { chrome.storage.local.set({ [POS_KEY]: pos }); } catch (_) {}
  }

  // ── 单击：以弹窗形式打开 Summary ─────────────
  function handleClick() {
    if (!chrome.runtime?.id) { markStale(); return; }
    openModal();
  }

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
    document.addEventListener('keydown', _onModalEsc);

    // 防止弹窗打开时背景页面滚动
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');

    requestAnimationFrame(() => overlay.classList.add('__tn-visible__'));
  }

  function closeModal() {
    const overlay = document.getElementById(MODAL_ID);
    if (!overlay) return;
    document.removeEventListener('keydown', _onModalEsc);
    document.documentElement.style.overflow = '';
    overlay.classList.remove('__tn-visible__');
    setTimeout(() => overlay.remove(), 220);
  }

  function _onModalEsc(e) {
    if (e.key === 'Escape') closeModal();
  }

  // ── 监听来自后台的弹窗指令 ───────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'OPEN_MODAL')  openModal();
    if (message.type === 'CLOSE_MODAL') closeModal();
  });

  // ── 监听来自 iframe 内部的关闭请求（ESC from search box）──
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'TN_CLOSE_MODAL') closeModal();
  });

  function markStale() {
    btn.title            = 'TabNirvana was reloaded — please refresh this page';
    btn.style.background = 'linear-gradient(135deg, #f87171, #ef4444)';
  }
})();
