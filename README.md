# TabNirvana

> A Chrome extension that brings calm to tab chaos — group, preview, and close tabs across all windows from a single overlay panel.

---

## Features

- **Modal overlay** — Click the floating button or press `Alt+V` to open the tab manager as an overlay on the current page. No new tabs created.
- **All-windows overview** — Displays tabs from every open browser window, grouped by domain. Tabs from other windows are labeled `W2`, `W3`, etc.
- **Content preview** — Each tab row shows an auto-extracted text summary and OG image thumbnail so you can recall what a page is about without opening it.
- **Hover preview** *(opt-in)* — Enable the "Preview" toggle in the header to fetch and render a live 320×200 miniature of any tab's actual webpage content on hover.
- **Real-time sync** — The panel reflects tab changes (open, close, navigate) across all windows instantly, no manual refresh needed.
- **Quick search** — Filter all tabs by title, URL, domain, or summary text. Press `Esc` to clear, press `Esc` again (on empty input) to close the panel.
- **Full keyboard navigation** — Navigate the entire panel without a mouse: `↑`/`↓` move between tab rows, `←`/`→` jump between masonry columns, `Enter` activates a tab, `Delete`/`Backspace` closes it, `Shift+Delete` closes the entire domain group.
- **Duplicate detection** — Tabs sharing the same URL are flagged with an amber `×N` badge.
- **Batch close** — Close a single tab, an entire domain group, or all tabs at once.
- **Draggable button** — Drag the floating button anywhere on the page; it snaps back to the right edge when released nearby. Position is persisted across sessions.

---

## Keyboard Shortcuts

### Global

| Action | Shortcut |
|--------|----------|
| Open TabNirvana | `Alt+V` |
| Close panel | `Esc` |

> The default shortcut can be changed at `chrome://extensions/shortcuts`.

### Inside the panel

| Action | Shortcut |
|--------|----------|
| Focus search box | Auto-focused on open, or press `/` |
| Move into the tab grid | `↓` (from search box) |
| Navigate between tab rows | `↑` / `↓` |
| Navigate between columns (left / right) | `←` / `→` |
| Activate (switch to) selected tab | `Enter` |
| Close selected tab | `Delete` or `Backspace` |
| Close all tabs in the current domain group | `Shift+Delete` or `Shift+Backspace` |
| Clear search text | `Esc` (when search has text) |
| Close panel from search box | `Esc` (when search is empty) |

---

## Installation (Local / Unpacked)

1. Download or clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `tab-nirvana/` folder
5. The TabNirvana icon appears in your toolbar — you're ready

> **Important:** Do not move or delete the folder after loading. Chrome references it directly.

---

## Privacy & Security

TabNirvana is designed for environments with strict data-security requirements.

| Item | Status |
|------|--------|
| External data transmission | None |
| Third-party analytics / tracking | None |
| Remote scripts or CDN resources | None |
| Third-party API calls | None |
| Local storage | Button position + preview toggle state only |

**Network requests:**
- Favicons are loaded directly from the sites you already have open — identical to normal browsing.
- OG image thumbnails come from those same sites and are only requested for tabs you have open.
- Hover preview (opt-in): the background service worker fetches the target page's HTML on demand; content is rendered locally in a sandboxed iframe and never transmitted externally.

**Permissions:**
- `tabs` — read tab title, URL, favicon, and window assignment
- `windows` — identify and focus browser windows for cross-window navigation
- `storage` — persist button position and preview toggle preference
- Host permissions (`http://*/*`, `https://*/*`) — inject the floating button into every page; fetch HTML for opt-in hover preview

---

## Project Structure

```
tab-nirvana/
├── manifest.json              # Extension manifest (MV3)
├── background.js              # Service worker — message router, preview fetcher
├── content_scripts/
│   ├── extractor.js           # Extracts page metadata (OG, description, headings)
│   ├── floating-btn.js        # Floating button + modal overlay logic
│   └── floating-btn.css       # Floating button + modal styles
├── summary/
│   ├── index.html             # Tab overview panel
│   ├── app.js                 # Panel logic (grouping, search, close, hover preview)
│   └── style.css              # Panel styles
└── assets/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Browser Compatibility

Requires **Chrome 89+** (released March 2021). All current Chrome versions are supported.

---

## License

MIT
