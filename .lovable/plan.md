## Goal
Make the app open and respond as quickly as Telegram — near-instant first paint, no blocking work, and snappy send/receive.

## Changes

### 1. Faster first paint
- Preload the app CSS in `src/routes/__root.tsx` `head().links` (`rel="preload" as="style"`) so the stylesheet fetch starts before the parser sees the `<link rel="stylesheet">`.
- Drop the unused `sonner` toaster bundle on first paint: lazy-load `<Toaster />` behind `React.lazy` + `Suspense fallback={null}` so the ~15KB toast library isn't in the critical chunk.
- Remove the currently unused `@tanstack/react-query` provider from the root (this chat has no queries) to cut the vendor bundle. Re-add only if we introduce server data caching later.

### 2. Cut the JS the browser has to parse
- Replace the four `lucide-react` icon imports in `src/routes/index.tsx` (`Send`, `Trash2`, `Bot`, `Loader2`) with tiny inline SVG components in a new `src/components/icons.tsx`. `lucide-react` is tree-shaken but still ships a large module graph; inline SVGs are ~200 bytes each.
- Remove the unused `qrcode.react` dependency from `package.json` (it was added for the old invite flow that no longer exists).

### 3. Faster route boot
- Keep `/` with `ssr: false` (already set) so no server round-trip is needed to render the shell — the HTML ships pre-rendered, JS hydrates and shows the empty-state instantly.
- Add `defaultPreload: "intent"` on the router (currently default) so any future links preload on hover/focus.

### 4. Snappier chat interactions
- Switch the auto-scroll effect to `behavior: "auto"` for the very first message and `"smooth"` after that, so the first render doesn't wait a frame for smooth-scroll animation.
- Debounce the textarea auto-grow: use a single `onInput` handler that adjusts height directly on the ref instead of re-rendering on every keystroke via `setInput` alone (keeps controlled value but avoids layout thrash).
- Preconnect to the AI gateway origin (`https://ai.gateway.lovable.dev`) via `<link rel="preconnect">` in `__root.tsx` head — cuts ~100–300ms off the first AI reply by warming DNS/TLS while the user is typing.

### 5. Cache the static shell
- Keep responses fast on repeat visits by adding a small in-memory `Cache-Control: public, max-age=0, must-revalidate` hint to the root route so the browser revalidates instead of refetching. (No service worker — that was tied to the removed PWA setup.)

## Out of scope
- No new features, no design changes, no re-adding auth or persistence.
- No server-side rendering changes beyond the existing `ssr: false` on `/`.

## Verification
- After build, confirm the initial `/` HTML + JS is smaller than before (check the vite build output sizes).
- Load the preview URL and confirm the chat UI paints immediately with no visible layout shift.
- Send one message and confirm the send button responds within one frame and the reply streams back with no perceptible extra latency from cold-connect.
