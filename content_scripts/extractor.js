// ──────────────────────────────────────────────
// TabNirvana — Page Content Extractor
// Runs on every page at document_idle.
// Extracts rich metadata so the summary can show
// a meaningful preview beyond just title + URL.
// ──────────────────────────────────────────────
(function () {
  // Guard against double-injection (e.g. bfcache restore)
  if (window.__tabNirvanaExtracted) return;
  window.__tabNirvanaExtracted = true;

  /** Safe getAttribute or textContent helper */
  function pick(selector, attr) {
    const el = document.querySelector(selector);
    if (!el) return '';
    const val = attr
      ? (el.getAttribute(attr) || el[attr] || '')
      : (el.textContent || '');
    return String(val).trim();
  }

  function extractData() {
    // ── Meta description (highest quality, curated by site author) ──
    const description =
      pick('meta[name="description"]', 'content') ||
      pick('meta[property="og:description"]', 'content') ||
      pick('meta[name="twitter:description"]', 'content') ||
      '';

    // ── Preview image (OG / Twitter card) ──
    const ogImage =
      pick('meta[property="og:image"]', 'content') ||
      pick('meta[name="twitter:image"]', 'content') ||
      '';

    // ── Favicon ──
    const favicon =
      pick('link[rel="icon"]', 'href') ||
      pick('link[rel="shortcut icon"]', 'href') ||
      pick('link[rel="apple-touch-icon"]', 'href') ||
      `${location.origin}/favicon.ico`;

    // ── Main heading ──
    const heading =
      pick('h1') ||
      pick('meta[property="og:title"]', 'content') ||
      pick('meta[name="twitter:title"]', 'content') ||
      '';

    // ── Body snippet — find the first meaty paragraph ──
    let snippet = '';
    if (!description) {
      const SELECTORS = [
        '[role="main"] p',
        'main p',
        'article p',
        '[class*="content"] p',
        '[class*="article"] p',
        '[class*="body"] p',
        'p',
      ];
      for (const sel of SELECTORS) {
        const paragraphs = document.querySelectorAll(sel);
        for (const p of paragraphs) {
          const text = p.textContent?.trim() || '';
          // Skip nav/footer junk: must be ≥ 60 chars and not mostly links
          const linkRatio = p.querySelectorAll('a').length / Math.max(text.length / 20, 1);
          if (text.length >= 60 && linkRatio < 0.5) {
            snippet = text.slice(0, 200);
            break;
          }
        }
        if (snippet) break;
      }
    }

    return {
      url: location.href,
      domain: location.hostname,
      description: description.slice(0, 220),
      heading: heading.slice(0, 120),
      snippet: snippet.slice(0, 220),
      ogImage,
      favicon,
    };
  }

  function sendData() {
    if (!chrome.runtime?.id) return; // orphaned content script — skip silently
    // sendMessage is async in MV3; attach .catch() to suppress unhandled rejections
    chrome.runtime.sendMessage({
      type: 'TAB_DATA_EXTRACTED',
      data: extractData(),
    }).catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendData, { once: true });
  } else {
    sendData();
  }
})();
