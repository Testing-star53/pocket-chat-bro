## Goal

Add a "Forgot password?" flow so users who forget their password can reset it via email.

## Changes

1. **`src/routes/auth.tsx`** — on the sign-in screen, add a "Forgot password?" link below the password field. Clicking it:
   - Prompts for the email (prefills the field they typed).
   - Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: \`${window.location.origin}/reset-password\` })`.
   - Shows a toast: "Password reset link sent to your email."

2. **`src/routes/reset-password.tsx`** (new, public route, `ssr: false`) — landing page from the reset email:
   - Detects `type=recovery` in the URL hash (Supabase auto-establishes a recovery session).
   - Shows a form with "New password" + "Confirm password".
   - Calls `supabase.auth.updateUser({ password })`.
   - On success: toast, sign out, redirect to `/auth`.
   - On error / missing recovery session: show a message + link back to `/auth`.

3. Confirm auth email templates are active (Lovable Cloud auto-confirm was enabled, but password-reset emails still send). If the reset email doesn't arrive, we'll set up email infra as a follow-up.

## Files touched

- `src/routes/auth.tsx` — add "Forgot password?" link + handler.
- `src/routes/reset-password.tsx` — new file.
