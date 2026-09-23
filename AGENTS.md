# Cata's Fitness Tracker

Read CALENDAR_PRIVACY_RULES.md before calendar-related work. It is mandatory.

- Google Calendar is READ ONLY. No event creation, modifications, deletion, invitations, reminders, emails, or contacting anyone. Never use alternative tools to perform prohibited actions.
- Every Calendar events request must be GET, use singleEvents=true, and set timeMin no earlier than 2026-09-01T04:00:00Z (midnight September 1 in Toronto). No unbounded search, sync tokens, recurring master/history requests, or event detail endpoints.
- User confirmed there are no events starting before September 1 and ending afterward. Google timeMin filters by event end time; preserve that documented assumption and date check. Do not claim Google OAuth enforces date restrictions.
- Only request calendar.events.readonly for Calendar. Basic Google identity scopes openid/email identify and restrict the owner; no Gmail access. Reject broader granted Calendar scopes.
- Credentials/tokens must never go into Git, browser responses, screenshots, or logs. Store OAuth refresh tokens encrypted in the database; keep keys in deployment secrets. Tests must use fake events and tokens.
- Preserve the approved interface: baby-blue background, frosted-blue panels, Manrope title, bright pink rings and percentages capped at 100%, true counts even over goal, weekly mix above seven-day desktop calendar, green completed cards, peach upcoming cards, subtle plus-only button on the right.
- Vercel is the user's selected hosting provider. Do not publish through Sites or create a competing deployment.
- Run npm test and npm run build before handoff. Do not fetch live Calendar data as a deployment check.

- Preserve one latest goal per Toronto week and per calendar month in the database. Saving again replaces that period’s target, without revision history. Monthly goals are manually set and never summed from weekly targets. Never overwrite past periods when defaults change. Historical analysis is out of scope for now.
