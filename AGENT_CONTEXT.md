# Agent Context: CodeReader

## Project Overview
**CodeReader** is a fast, client-side web application designed for developers to view, format, highlight, and analyze code snippets directly in the browser. It emphasizes privacy (no server-side processing), speed, and utility.

## Unique Selling Points
- **Client-Side Only**: Secure; code never leaves the browser.
- **Instant**: No heavy IDE load times.
- **AI Integration**: Sidebar integration with LLMs (Gemini, ChatGPT, Grok) for code explanation and analysis.
- **Utility**: Auto-copy, Auto-highlight, Syntax Highlighting for 180+ languages.

## Current State (As of 2026-02-08)

### Recent Accomplishments
1.  **SEO Loop Implementation**:
    -   Added `robots.txt` and `sitemap.xml` for crawling.
    -   Implemented JSON-LD `SoftwareApplication` Schema.
    -   Updated `<title>` and `<meta description>` for better CTR.
    -   Added a semantic "Why use this tool" content section to `index.html` to capture intent keywords.
    -   **Style Fix**: Enabled scrolling on `#input-view` to accommodate new SEO content.

2.  **UI/UX Refinements**:
    -   **Structure Sidebar**: Fixed a bug where long lists of functions were vertically truncated/squashed. Added `flex-shrink: 0` to items.
    -   **Sticky Controls**: Toolbar remains visible while scrolling.

### File Structure
-   `index.html`: Main application structure. Contains Input View (Editor) and Output View (Viewer).
-   `style.css`: All styling. Uses CSS Variables for theming (currently Dark Mode focused).
-   `script.js`: Core logic. Handles state (localStorage), View switching, Highlight.js integration, and AI Sidebar toggling.
-   `robots.txt` / `sitemap.xml`: SEO assets.

### Known Constraints
-   **Local Storage**: User preferences (Account ID, Auto-copy settings) are stored in `localStorage`.
-   **AI Integration**: Some models (ChatGPT) require pop-ups due to `X-Frame-Options` restrictions; Gemini uses a specific URL pattern.

## Roadmap / Todo
-   [ ] **PWA Support**: Add `manifest.json` and Service Worker for offline capability.
-   [ ] **Theme Toggle**: Currently hardcoded to Dark Mode (`slate-900`). Consider adding Light Mode.
-   [ ] **File Upload**: Drag-and-drop file support (currently Paste only).
-   [ ] **Mobile Optimization**: Further refine the sidebar experience on mobile devices.

## Tech Stack
-   **HTML5**
-   **CSS3** (Variables, Flexbox, Grid, Backdrop Filter)
-   **Vanilla JavaScript** (ES6+)
-   **Highlight.js** (External Dependency)
