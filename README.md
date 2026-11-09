# ⚡ JS Scratchpad

> **Pure JavaScript & TypeScript Playground** — Minimal, Fast, Zero Signup, Zero Fluff.

JS Scratchpad is an elite, distraction-free environment built for developers who want to test, prototype, and play with pure JavaScript and TypeScript. No signups, no heavy full-stack web containers, and no complex setup—just open a tab, write code, hit **Run**, and see instant results.

---

## 🚀 Key Features

### 🖥️ First-Class Editor Experience
* **Monaco Editor (VS Code engine)**: Full TypeScript & JavaScript syntax highlighting, IntelliSense, auto-closing brackets, code folding, and formatting (`⌘⇧F` / `Ctrl⇧F`).
* **Multi-Tab Workspace**: Work with multiple files simultaneously. Create, duplicate, rename, download, and switch tabs using `⌘1`–`⌘9`.
* **Dark & Light Modes**: Seamless dark and light themes with system preference synchronization.
* **Automatic Type Acquisition (ATA)**: Automatically fetches TypeScript definitions for imported npm packages in real-time.

### ⚡ Blazing-Fast, Sandboxed Execution
* **Isolated Web Worker**: Code runs inside a sandboxed Web Worker, ensuring your browser UI remains 100% fluid and responsive.
* **Instant Offline Transpilation**: TypeScript and JSX are transformed on-the-fly using [Sucrase](https://github.com/alangpierce/sucrase)—no network connection or heavy compiler download required.
* **Top-Level `await`**: Write top-level asynchronous code and fetch requests directly without wrapping them in async IIFEs.
* **Configurable Execution Timeouts**: Defend against infinite loops with configurable timeouts (1s, 3s, 5s, 10s, 30s, 60s, or None).
* **Selection Execution**: Highlight a specific block of code and press `⌘⇧↵` / `Ctrl⇧↵` to execute only the selection.

### ⏱️ Event Loop & Async Timing Tracing
* **Relative Delta Timestamps**: Every `console.log`, `info`, `warn`, `error`, and `table` entry displays an execution offset badge (e.g. `+0ms`, `+1002ms`).
* Visually understand Promise resolution order, microtasks vs macrotasks, and `setTimeout` intervals with millisecond accuracy.

### 🏎️ Built-in Micro-Benchmarking (`bench`)
Test function performance out-of-the-box using the injected `bench(label, fn)` helper:
```js
const array = Array.from({ length: 1000 }, (_, i) => `item_${i}`);
const set = new Set(array);

await bench('Array.includes', () => array.includes('item_950'));
await bench('Set.has',        () => set.has('item_950'));
```
Automatically outputs operations per second, time per operation, and a ranked summary:
```text
⚡ [bench] Array.includes: 840,120 ops/sec (1.19 µs/op, 50,025 runs)
⚡ [bench] Set.has: 14,850,000 ops/sec (67.3 ns/op, 890,525 runs)

🏆 Benchmark Summary:
🥇 Set.has: 14,850,000 ops/sec (fastest)
   Array.includes: 840,120 ops/sec (17.7x slower)
```

### 🔗 Smart Sharing (Per-File & Entire Project)
* **Single File Sharing**: Create a dedicated share link for only the current active file.
* **Entire Project Sharing**: Package all open tabs and imported npm packages into a single snapshot.
* **Upstash Redis Backend**: Clean, persistent, readable short URLs (e.g. `https://your-domain.com/s/7x9kd2pa`).
* **Zero-Setup Fallback**: Seamlessly falls back to client-side LZ-string URL hash compression (`#code=...`) when offline or unconfigured.

### 📦 Dynamic NPM Packages
* Import any package directly from npm via [esm.sh](https://esm.sh):
  ```js
  import { chunk } from 'lodash-es';
  import dayjs from 'dayjs';
  ```
* Manage installed packages via the **Packages** menu with auto-complete and version support.

### 📚 Non-Destructive Presets Library
Open curated, real-world JavaScript experiments in dedicated new tabs without overwriting your current code:
* **⚡ Benchmarking**: Array vs Set vs Map lookup performance.
* **🔄 Event Loop Order**: `sync` vs `queueMicrotask` vs `Promise.then` vs `setTimeout(0)`.
* **⚡ Promise Concurrency**: `Promise.allSettled`, `Promise.race`, and `Promise.any` compared.
* **✨ Modern ES2024**: `Promise.withResolvers()`, new `Set` methods (`union`, `intersection`, `difference`), `Object.groupBy`, immutable array methods.
* **🔁 Resilient Async Retry**: Exponential backoff with randomized full jitter.
* **🧠 LRU Cache**: O(1) cache implementation using JavaScript `Map`.
* **⚙️ Generators & Async Iterables**: Lazy Fibonacci, stream pagination, and `Symbol.iterator`.
* **🌲 Data Structures**: Binary Search Tree with in-order DFS and level-order BFS.
* **🔩 WebAssembly (WAT)**: Native WebAssembly Text Format compilation and execution in-browser.

### 📱 PWA & Offline-Ready
* Installable as a progressive web app on macOS, Windows, Linux, iOS, and Android.
* Fully cached for instant offline operation via Workbox service worker.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `⌘↵` / `Ctrl↵` | Run code |
| `⌘⇧↵` / `Ctrl⇧↵` | Run selection only |
| `⌘K` / `CtrlK` | Open Command Palette |
| `⌘L` / `CtrlL` | Clear Console |
| `⌘S` / `CtrlS` | Save document (and format if enabled) |
| `⌘⇧F` / `Ctrl⇧F` | Format code |
| `⌘1` – `⌘9` | Switch between tabs 1 through 9 |
| `⌘/` / `Ctrl/` | View keyboard shortcuts |
| `Esc` | Close dialogs / palettes |

---

## 🛠️ Tech Stack

* **Frontend**: React 19, TypeScript, Vite
* **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/) (`@monaco-editor/react`)
* **Execution Sandbox**: Web Worker, [Sucrase](https://github.com/alangpierce/sucrase) (offline JS/TS transpilation), [Acorn](https://github.com/acornjs/acorn) (AST auto-return)
* **Storage & Sharing**: [Upstash Redis](https://upstash.com) + [LZ-String](https://github.com/pieroxy/lz-string)
* **Backend**: Vercel Serverless Functions (`/api/share`, `/api/get`)
* **PWA**: `vite-plugin-pwa`, Workbox
* **Linter**: [Oxlint](https://oxc.rs)

---

## 📦 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher recommended)
* `npm` or `pnpm`

### Installation
```bash
git clone https://github.com/narendramanchala/js-scratchpad.git
cd js-scratchpad
npm install
```

### Running Locally
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Note**: Local dev includes a built-in mock API in `vite.config.ts`, so sharing and loading `/s/:id` links works locally out-of-the-box without needing credentials.

---

## 🌐 Production Deployment (Vercel + Upstash Redis)

### 1. Connect Upstash Redis
1. Create a free database at [console.upstash.com](https://console.upstash.com).
2. Copy your **REST API credentials**:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 2. Deploy to Vercel
1. Import this repository into [Vercel](https://vercel.com).
2. In your Vercel Project Settings under **Environment Variables**, add:
   * `UPSTASH_REDIS_REST_URL` = `<your_upstash_rest_url>`
   * `UPSTASH_REDIS_REST_TOKEN` = `<your_upstash_rest_token>`
3. Deploy! Clean `/s/:id` snippet sharing will now be live worldwide.

---

## 📄 License
MIT
