## Problem

Signup succeeds (HTTP 200) but the immediate `signInWithPassword` returns `invalid_credentials`. Cause: email confirmation is required on this project, so the new user is created in an unconfirmed state and cannot log in with password until they click the confirmation email. The auth page tries to sign in right after signup, which fails.

## Fix

1. **Enable auto-confirm email** on the Lovable Cloud auth settings so new signups are instantly usable (no email verification step). This directly resolves the "Invalid login credentials" right-after-signup case.
   - `disable_signup: false`, `external_anonymous_users_enabled: false`, `auto_confirm_email: true`, `password_hibp_enabled: true`.

2. **Harden `src/routes/auth.tsx` signup flow** so it's robust even if confirmation is ever re-enabled:
   - After `signUp`, check if a session was returned. If yes → navigate to `/`.
   - If no session (confirmation required) → show a clear toast: "Check your email to confirm your account" instead of attempting `signInWithPassword` and surfacing a confusing "Invalid login credentials" error.
   - Keep the sign-in branch as-is.

3. **Improve error message mapping** on sign-in: when Supabase returns `invalid_credentials`, show "Wrong email or password" instead of the raw string, so future mistakes are clearer.

No database or UI-layout changes. Existing chat, share/QR, auto-delete, and settings features remain untouched.

## Files touched

- `src/routes/auth.tsx` — signup post-flow + friendlier error text.
- Auth config via `supabase--configure_auth` — enable auto-confirm.
