
## Goal
Turn Pocket Chat Bro into a no-login, single-page chat with one AI bot ("Pocket AI"). Multilingual replies, in-memory only, with a Clear button.

## Changes

### Remove
- All auth: delete `src/routes/auth.tsx`, `src/routes/_authenticated/` folder (route guard, index, settings, new, chat.$conversationId).
- Auth-related UI (sign in/out, profile, settings, share QR, contacts, presence, typing, unread).
- Supabase realtime + database usage from the client. Keep the Supabase client file untouched (auto-gen), just stop using it.
- `src/lib/ai-bro.functions.ts` auth middleware requirement (make it public — no `requireSupabaseAuth`).
- `src/start.ts` `attachSupabaseAuth` middleware (leave array empty).

### Add / Update
- `src/routes/index.tsx`: full-screen Telegram-style chat with Pocket AI.
  - Messages stored in React state only (no localStorage, no DB). Refresh = gone.
  - Header: avatar + "Pocket AI" + "Bot" badge + trash icon (Clear all).
  - Composer: text input + send button.
  - Renders markdown, shows typing dots while awaiting reply.
  - "Clear" button wipes state instantly, no confirmation dialog needed beyond a single tap (small confirm via toast/inline).
- `src/lib/ai-bro.functions.ts` (public serverFn):
  - Accepts `{ messages: {role, content}[] }`, no user context.
  - System prompt instructs: detect the user's language and always reply in that same language, professional and concise.
  - Uses Lovable AI gateway (`google/gemini-3.6-flash`), streams or returns text.
  - Does NOT persist anything.

### Data / Storage
- No database reads or writes. No tables touched. No localStorage. Fully in-memory.
- Existing Supabase tables remain but are unused (safe to ignore; not deleting to avoid destructive migration unless you want it).

## Technical notes
- `src/routes/__root.tsx`: remove the `supabase.auth.onAuthStateChange` effect since auth is gone.
- Root route stays as shell; `/` renders the chat directly.
- Delete generated route tree entries by removing route files; Vite plugin regenerates `routeTree.gen.ts`.
- Server function stays server-side so `LOVABLE_API_KEY` is not exposed.

## Out of scope
- Dropping Supabase project / migrations (kept dormant).
- Any persistence, sharing, multi-user, or notifications.
