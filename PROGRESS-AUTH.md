# PROGRESS-AUTH.md

Tracks the **Auth enhancements** build (root redirect, forgot password, email/username login,
5h idle-logout) for Sinag Ukit BMS. Follows the same convention as `PROGRESS-MANAGEMENT.md`/
`PROGRESS-QUOTES.md`: `AUTH-` prefixed phases, kept separate from the core `PROGRESS.md`
numbering. Append-only.

Source: verbal kickoff from Sinag 2026-07-10 — four asks in one message: (1) redirect `/` to
`/login`, (2) add forgot-password (link + email-entry page + reset flow), (3) enable email or
username login, (4) force logout after 5h inactivity. No separate kickoff doc — this file is
self-contained.

---

## Locked decisions (read this before starting any phase)

- **Root redirect preserves the existing "already logged in → /dashboard" behavior** — only the
  unauthenticated path changes (was: marketing landing page; now: `/login`). Confirmed sensible
  default, not separately asked.
- **Username backfill: auto-generated from email local-part**, not left blank for self-service.
  Confirmed via `AskUserQuestion`. All 7 existing accounts got a username immediately
  (`claude-code@sinagukit.internal` → `claude_code`, etc.) so username login works without
  anyone needing to set one up first.
- **5h idle-logout scope: all authenticated routes**, not just `/dashboard/*`. Confirmed via
  `AskUserQuestion`. (Later narrowed by AUTH-6 to exclude `/auth/*` specifically — see below;
  that's an implementation-detail carve-out, not a reversal of this decision.)
- **Forgot-password reuses the existing `/auth/update-password` page** (already live, previously
  only reachable from the in-dashboard Account > Profile "Send Password Reset Email" button) —
  no new password-set page was built, just a new entry point (`/forgot-password`) that calls the
  same `resetPasswordForEmail` + `redirectTo` pattern.
- **Username lookup uses a public (anon-executable) `SECURITY DEFINER` RPC**
  (`get_email_for_username`), not a client-side pre-check against `profiles` — anon has no other
  read access to `profiles`, and login must work pre-session. Accepted as intentional/minimal
  disclosure for this ~7-account internal app; flagged explicitly in the Supabase security
  advisors output as expected.

---

## AUTH-1 — Root redirect ✅ DONE

**Status:** Complete 2026-07-10.

`app/page.tsx` rewritten from a marketing landing page to a pure redirect:
`redirect(user ? "/dashboard" : "/login")`. Old landing content removed (recoverable from git
history).

**Verification:** Browser-tested — unauthenticated visit to `/` lands on `/login` with the
"Email or Username" field and "Forgot password?" link rendered.

## AUTH-2 — Forgot password ✅ DONE (email round-trip not yet confirmed — see Open items)

**Status:** Code complete 2026-07-10; full email-click round-trip blocked by Supabase's
built-in-SMTP rate limit during same-session testing (see Open items).

- New public page `app/forgot-password/page.tsx` (client component) — email input, calls
  `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/auth/update-password' })`,
  always shows a generic "if that email is registered, we've sent a link" message (no
  account-existence leak).
- `/login` got a "Forgot password?" link pointing at `/forgot-password`.
- No changes needed to `/auth/update-password` itself for this phase (see AUTH-6 for a real bug
  found in it during verification).

**Verification so far:**
- Browser-tested the page renders and the client-side `resetPasswordForEmail` call fires
  correctly — confirmed via Supabase's own validation response (`*.internal` test-domain emails
  correctly rejected as non-deliverable at the API level, not an app bug).
- Real end-to-end test (Sinag, real gmail-domain email): request succeeded, reset email
  confirmed sent and received. **Second/third same-session attempts hit Supabase's built-in
  email rate limit** ("email rate limit exceeded") — expected given the volume of testing in a
  short window (built-in Supabase SMTP caps at a handful of emails/hour), not a bug. Full
  click-the-real-link round trip through the fixed `/auth/update-password` page (AUTH-6) has
  **not yet been re-confirmed** after that fix landed — see Open items.

## AUTH-3 — Email/username login ✅ DONE

**Status:** Complete 2026-07-10.

- Migration `add_username_login_support`: `profiles.username` (text, `NOT NULL`, unique,
  format `^[a-z0-9_.]{3,32}$`), backfilled from email local-part for all 7 existing accounts.
  `handle_new_user()` (the `on_auth_user_created` trigger) updated to generate a default
  username the same way for future signups/invites. New RPC
  `get_email_for_username(p_username text) returns text` (`SECURITY DEFINER`, `EXECUTE` granted
  to `anon`+`authenticated`).
- Follow-up migration `revoke_public_execute_on_trigger_functions`: revoked anon/authenticated
  `EXECUTE` on `handle_new_user()` and a new trigger function (`prevent_profile_role_self_escalation`,
  see AUTH-5) — these are trigger-only and were flagged by `get_advisors` as needlessly
  anon-callable via REST; `get_email_for_username`'s equivalent warning is expected/intentional
  and was left as-is.
- `app/login/page.tsx` + `actions.ts`: field renamed to `identifier` ("Email or Username",
  `autoComplete="username"`). If the value has no `@`, resolved via `get_email_for_username`
  before `signInWithPassword`; unknown username falls back to the same generic "Invalid login
  credentials" as a wrong password (no enumeration leak).
- Account > Profile page got a matching editable "Username" field (format-validated
  client+server side, `23505` unique-violation mapped to "That username is already taken.").

**Verification:** Browser-tested via the Claude Code admin test account end-to-end: signed in
with just the username `claude_code` + password (no `@` at all); a bogus/nonexistent username
correctly showed the same generic "Invalid login credentials" as a wrong password. Edited the
username field on Account > Profile (save succeeded — see AUTH-5 for why this previously
wouldn't have worked at all). HTML5 `pattern` validation confirmed blocking a too-short username
client-side before submit.

## AUTH-4 — 5h inactivity force-logout ✅ DONE

**Status:** Complete 2026-07-10 (later adjusted by AUTH-6).

`proxy.ts` (the correct file for this Next.js version — see `project_bms_architecture` memory)
now tracks an httpOnly `last_activity` cookie, sliding/refreshed on every authenticated request.
If the gap since `last_activity` exceeds 5h, proxy calls `supabase.auth.signOut()` (real
server-side token revocation, not just a cookie clear) and redirects to
`/login?error=Signed out due to inactivity...`, reusing the login page's existing error-banner
UI. Applies to all authenticated routes, matching the existing proxy matcher (per the locked
decision above) — **except `/auth/*`, carved out in AUTH-6**.

**Verification:** Logic reviewed and code-path-tested (couldn't wait a real 5h in-session);
confirmed the code compiles and doesn't interfere with normal login/logout/dashboard navigation
during the rest of this session's testing.

## AUTH-5 — Found and fixed: `profiles` missing self-UPDATE RLS policy ✅ DONE

**Status:** Complete 2026-07-10, found while implementing AUTH-3's Account > Profile username
field.

`profiles` had no RLS UPDATE policy for a user on their own row — only `"Admins manage all
profiles"` (`ALL`, admin-only) and `"Users can view own profile"` (`SELECT`). This meant the
**pre-existing** Account > Profile "Update Profile" button (full_name/contact_number/birthday,
built before this session) was silently no-op-ing for every non-admin role
(encoder/manager/cashier/viewer) — the update call returned no error, RLS just filtered it to
zero affected rows.

Fixed via the AUTH-3 migration: added a `"Users can update own profile"` policy
(`auth.uid() = id`), guarded by a new `BEFORE UPDATE` trigger
`prevent_profile_role_self_escalation` that raises unless `current_user_role() = 'admin'` when
`role` is changing — so the new self-update policy can't be used to self-promote.

**Verification:** Confirmed fixed live with the admin test account (profile save now persists
and shows "Profile updated successfully"). **Not re-tested with a non-admin role this
session** — worth a quick check with the encoder test account if it matters before this is
considered fully closed (see Open items).

## AUTH-6 — Found and fixed: `/auth/update-password` session race + idle-logout collision ✅ DONE

**Status:** Complete 2026-07-10, found while Sinag tested the real forgot-password flow.

Two related bugs surfaced from the first real end-to-end forgot-password attempt (real click on
a real recovery email, `jaysonc.valdez@gmail.com`, confirmed via
`mcp__supabase__get_logs(service: 'auth')`):

1. **Pre-existing latent bug in `/auth/update-password`** (page itself predates this session —
   see `project_bms_architecture` memory, built in Phase 19): it rendered the password form
   immediately on mount and allowed submission before the browser client had established (or
   failed to establish) a session from the recovery link's URL tokens — producing a raw
   `AuthApiError: Auth session missing!` instead of any real feedback. This was never caught
   before because the page had never been exercised by a real end-to-end email click prior to
   this session (its only prior use was the in-dashboard button, which nobody had actually
   clicked-through on a fresh/logged-out browser). Fixed by gating the form behind
   `getSession()` / `onAuthStateChange('PASSWORD_RECOVERY'|'SIGNED_IN')` with a 3s grace period;
   shows "This reset link is invalid or has expired" + a link back to `/forgot-password` if no
   session materializes in time.
2. **New bug introduced by AUTH-4, caught before it could bite someone for real:**
   `proxy.ts`'s idle-logout check ran on `/auth/*` too. A browser holding an old,
   still-technically-valid-but->5h-idle dashboard session would get force-signed-out and
   redirected to `/login` the instant it hit `/auth/update-password` via a recovery link —
   discarding the recovery link's own session tokens before the page could ever use them. Not
   the cause of bug #1 above (confirmed via auth logs — no `signOut`/`/logout` API call appears
   in that request's trace), but a real landmine on its own. Fixed by exempting
   `request.nextUrl.pathname.startsWith('/auth/')` from the idle-check entirely (session refresh
   via `getUser()` still runs there — only the forced-signout/redirect is skipped).

Also noticed during this investigation: `Error [AuthApiError]: Invalid Refresh Token: Refresh
Token Not Found` shows up repeatedly in the dev server console. Believed to be a known
noisy-but-harmless Supabase SSR/dev-mode quirk (stale `sb-*` cookie from an earlier sign-in/out
cycle in the same browser tab triggering a failed background refresh inside `getUser()`) — pages
rendered correctly through it every time it was observed this session. Not chased further;
flag if it ever correlates with an actually-broken page rather than just console noise.

**Verification:** Both fixes confirmed via browser preview (no-session case shows the correct
"invalid/expired" message, no crash, no TypeScript/compile errors). **The actual real-email
round trip has not yet been re-confirmed against the fixed page** — that's the explicit open
item below.

---

## Open items / not yet verified

- **[BLOCKING for full sign-off] Real forgot-password email round trip not yet confirmed against
  the AUTH-6 fix.** Sinag's retry attempt hit Supabase's built-in email rate limit ("email rate
  limit exceeded") from the volume of testing earlier in this same session — expected, not a
  bug, but it means the fixed `/auth/update-password` page has not yet actually been exercised
  by a real click-through. **Next step:** once the rate limit cools down (Supabase's built-in
  SMTP typically allows only a handful of emails/hour per project — wait at least an hour from
  the last attempt, or configure a custom SMTP provider in the Supabase dashboard if this needs
  to be reliable sooner), request a fresh reset link and click it through to confirm the
  password-update form actually appears and works. Do not consider AUTH-2/AUTH-6 fully closed
  until this happens.
- **Non-admin self-update of `profiles` (AUTH-5's fix) not re-verified with a non-admin
  account.** Only confirmed with the admin test account. Low risk (the RLS policy is
  straightforward `auth.uid() = id`) but worth a quick pass with the encoder test account
  (see `project_claude_encoder_test_account` memory) if this ever matters for real use.
- **5h idle-logout not tested against a real 5h wait.** Logic was reviewed and the code path
  exercised structurally, but nobody has actually left a session idle for 5 real hours to watch
  the force-logout fire. Low risk (the comparison logic is simple timestamp arithmetic) but
  flagging since it's the one AUTH-4 behavior that couldn't be directly observed this session.
- **`Invalid Refresh Token: Refresh Token Not Found` console noise** (see AUTH-6) — not fully
  root-caused, just observed to be harmless every time it appeared this session. Revisit only if
  it's ever seen alongside an actually broken page.
