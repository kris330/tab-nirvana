// ──────────────────────────────────────────────
// TabNirvana — Background Service Worker
// Stores extracted tab metadata & handles all
// tab management messages from the summary page.
// ──────────────────────────────────────────────

/** @type {Map<number, object>} tabId → extracted page metadata */
const tabDataStore = new Map();

// Top-level async function — used by FETCH_PREVIEW case below.
// Must be defined here (not inside the listener) because await
// is illegal in a non-async callback.
async function fetchPageHtml(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ──────────────────────────────────────────────
// Message Router
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {

    // Content script finished extracting a page's metadata
    case 'TAB_DATA_EXTRACTED': {
      if (sender.tab?.id) {
        tabDataStore.set(sender.tab.id, message.data);
      }
      sendResponse({ ok: true });
      break;
    }

    // Floating button clicked — open the summary tab in the same window
    case 'OPEN_SUMMARY': {
      const windowId = sender.tab?.windowId;
      if (!windowId) { sendResponse({ ok: false }); break; }
      chrome.tabs.create({
        url: chrome.runtime.getURL(`summary/index.html?windowId=${windowId}`),
        active: true,
      });
      sendResponse({ ok: true });
      break;
    }

    // Summary page requests the extracted metadata map (tab list is fetched directly by the page)
    case 'GET_TAB_METADATA': {
      // Return a plain object: { [tabId]: metadata }
      const out = {};
      tabDataStore.forEach((data, tabId) => { out[tabId] = data; });
      sendResponse({ metadata: out });
      break;
    }

    // Close a single tab (summary page can also call chrome.tabs.remove directly,
    // but routing through background keeps permissions centralised)
    case 'CLOSE_TAB': {
      chrome.tabs.remove(message.tabId).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }

    // Close multiple tabs at once
    case 'CLOSE_TABS': {
      if (!message.tabIds?.length) { sendResponse({ ok: true }); break; }
      chrome.tabs.remove(message.tabIds).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }

    // Fetch a page's HTML for the hover preview card
    case 'FETCH_PREVIEW': {
      fetchPageHtml(message.url)
        .then(html => sendResponse({ ok: true, html }))
        .catch(() => sendResponse({ ok: false }));
      return true; // keep message channel open for async sendResponse
    }

    // Navigate to an existing tab & focus its window
    case 'ACTIVATE_TAB': {
      chrome.tabs.update(message.tabId, { active: true });
      if (message.windowId) chrome.windows.update(message.windowId, { focused: true });
      sendResponse({ ok: true });
      break;
    }
  }
});

// ──────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  tabDataStore.delete(tabId);
});

// Toolbar icon click / keyboard shortcut → open modal on current page
chrome.action.onClicked.addListener((tab) => {
  const url = tab.url || '';
  const canInject  = url.startsWith('http://') || url.startsWith('https://');
  const isOurNewTab = url.startsWith(chrome.runtime.getURL('newtab/'));

  if (canInject || isOurNewTab) {
    // http/https pages and our custom new tab page both support OPEN_MODAL messaging
    chrome.tabs.sendMessage(tab.id, { type: 'OPEN_MODAL' }).catch(() => {
      if (canInject) {
        // Fallback for http/https: content script not yet injected
        chrome.tabs.create({
          url: chrome.runtime.getURL('summary/index.html'),
          active: true,
        });
      }
    });
    return;
  }

  // Other chrome:// pages — open as popup window (best effort)
  chrome.windows.create({
    url: chrome.runtime.getURL('summary/index.html'),
    type: 'popup',
    width: 1100,
    height: 720,
    focused: true,
  });
});
