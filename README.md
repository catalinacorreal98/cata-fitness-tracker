# Cata’s fitness tracker

Private, single-owner fitness dashboard for Vercel. Preserves the approved blue-and-pink design. Google Calendar access is strictly read-only, starting September 1, 2026 in America/Toronto. See [CALENDAR_PRIVACY_RULES.md](CALENDAR_PRIVACY_RULES.md).

## Deploy from GitHub

1. In Vercel, **Add New → Project → Import** this private repository.
2. Framework preset: **Other**. Build command: `npm run build`. Output directory: `public`. Node version: **22.x**. No custom domain required.
3. Deploy. Until configuration is complete the site shows a setup screen and cannot access calendar data.
4. In your Vercel project’s **Storage** tab, connect a **Neon Postgres** database. Choose its free tier if available and check its limits. It must provide `DATABASE_URL`. Tables are created automatically on the first authorized request.
5. Add the following under **Settings → Environment Variables**, for **Production only**. Do not put credentials in GitHub, screenshots, chat messages, or client-side variables.

| Variable | Value |
| --- | --- |
| `APP_URL` | The exact stable production URL, e.g. `https://your-project.vercel.app` (no path) |
| `ALLOWED_GOOGLE_EMAIL` | Your Google account email; only this account can use the tracker |
| `GOOGLE_CLIENT_ID` | Your Google OAuth **Web application** client ID |
| `GOOGLE_CLIENT_SECRET` | Its client secret |
| `DATABASE_URL` | From the Neon integration |
| `SESSION_SECRET` | A unique random secret of at least 32 characters |
| `TOKEN_ENCRYPTION_KEY` | 32 random bytes encoded as base64url |
| `CRON_SECRET` | A separate unique random secret of at least 32 characters |
| `GOOGLE_CALENDAR_ID` | `primary`, unless the classes are in another specific calendar |

Generate each of the three secrets independently on your computer using `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Store them privately. Losing or rotating the token-encryption key requires reconnecting Google Calendar.

6. In **Google Auth Platform → Clients → Cata’s Fitness Tracker – Web**, add the authorized redirect URI **`YOUR_APP_URL/api/auth`**. JavaScript origins are not needed for this server-side flow.
7. Google consent data access: request only `calendar.events.readonly` for Calendar. The app additionally requests `openid` and `email` solely to verify your identity and restrict access to you. It does not request Gmail access, profile access, or calendar write access. Broader grants are rejected.
8. If Google consent is in **Testing**, add your email under **Audience → Test users**. Testing-mode refresh tokens for these scopes normally expire after seven days; use a suitable production consent configuration for unattended long-term synchronization, subject to Google’s policies and any requirements shown in its console. Otherwise you must reconnect weekly. Do not assume deployment alone removes Google’s testing limitation.
9. Redeploy in Vercel after adding environment variables. Open the app, click **Connect Google Calendar**, and approve the read-only permission with the allowed account. First sign-in triggers the initial bounded read.
10. Enter your own weekly and monthly goals. The app does not treat prototype values or screenshot events as live data.

## Synchronization and privacy

- Only one selected calendar is read, using the events-list API with GET, `singleEvents=true`, and a hard lower bound of `2026-09-01T04:00:00Z`. No sync-token calls, event-detail calls or recurring-master retrievals.
- The user confirmed that no events start before September 1 and end afterward. Google’s `timeMin` filters by **end time**, so this confirmation is relevant. OAuth scopes do not enforce a date boundary. Returned starts are also checked defensively; this is not a substitute for the bounded request.
- Each successful sync replaces the cached matching fitness events from the cutoff through the end of next month. This removes deleted, moved, or newly nonmatching events, including historical corrections. Failed or partially completed syncs leave the previous snapshot intact.
- Unrelated event details are processed only in memory for classification and are not saved. No descriptions, guests, email addresses, or attendee lists are requested. Fitness titles, times, location and category are stored in your database.
- The schedule is `0 11 * * *` (UTC) daily. On Vercel Hobby, expect approximately **7–8 AM Toronto summer time** and **6–7 AM winter time**, not exact-minute execution. Refresh-on-open and manual refresh are coalesced for five minutes; the last successful sync time is visible. Automatic retries occur on the next open/refresh/scheduled run.
- Google Calendar events are never created, changed or deleted. Manual additions and removals affect only the tracker. No invitations, reminders, messages, or notifications are sent to people.
- Google refresh tokens are AES-256-GCM encrypted in the database. Keys remain in Vercel production secrets. Sessions are signed, HttpOnly cookies. Every data endpoint verifies the owner. Mutations require same-origin requests, and cron requires its private bearer secret. Public assets contain no fitness data.
- Review Vercel Deployment Protection if enabled: production OAuth redirects and Vercel cron invocations must reach their routes. The app’s own owner checks must remain enabled regardless of platform protection. Never make private data endpoints public to work around a platform gate.
- Avoid production credentials in preview deployments. Pin `APP_URL` to the production origin. The local app and tests do not read Calendar until real configuration and owner authorization are deliberately supplied.

## Use

The current week starts Monday; the month is a calendar month, both Toronto time. Classes count as completed only after they end. Future and ongoing classes remain upcoming. Each class counts once; progress percentages cap at 100%, while actual counts can exceed goals. Goals apply to this period and future periods, with past snapshots preserved. Manual activities are saved separately from synced events. Under Goals → Class matching, adjust words used to recognize fitness classes; rules apply on the next successful sync. Review matches after first connection.

## Monthly view

The Monthly tab shows the current Toronto calendar month. It opens on Completed, using the same completion timestamp and event set as the overview's monthly count. Upcoming and All filters update both the activity chart and chronological list. Calendar classes and manual entries are included. Each activity uses the same color in the weekly chart, monthly chart and monthly row accents. The view reads the existing saved calendar cache; it does not introduce additional Calendar API requests or permissions.

## Saved goals

Weekly and monthly goals are independent values in Postgres, keyed by period type and start date in Toronto time. For example, the September 21–27 week is stored as `week / 2026-09-21`, while September is `month / 2026-09-01`. A unique primary key guarantees one target per period. Saving September first as 4 and later as 6 updates the same record to 6; no revision history is recorded. Monthly targets are never calculated from weekly targets.

New periods inherit the most recently saved defaults when first opened. Existing period records are never overwritten by opening the dashboard or syncing Calendar. Explicit saves update the current week and month only, plus the defaults for future periods. A form left open across a period boundary is rejected rather than saving its values against the wrong dates. Closing the browser or redeploying the app does not erase goals: they remain in the connected database. Historical analysis is intentionally not included yet.

## Local checks

`npm install`, `npm test`, `npm run build`. For a local setup-screen preview: `npm run dev`.

Tests use fake calendar responses and fake credentials, never real Google data. Live database provisioning, OAuth consent, Vercel cron and production connectivity must be verified during deployment. The app does not send emails or create calendar items as tests.

## Official setup references

- [Google Calendar read-only scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Google web-server OAuth and refresh tokens](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel storage](https://vercel.com/docs/storage)
