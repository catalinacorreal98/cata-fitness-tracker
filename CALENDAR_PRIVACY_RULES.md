# Mandatory calendar access rule

Explicit user instruction for the Fitness tracker project:

NEVER read the user's calendar before September 1, 2026, in America/Toronto.

The inclusive boundary is 2026-09-01T00:00:00-04:00, equivalent to 2026-09-01T04:00:00Z.

- This restricts data access, not merely display or counting. Never retrieve earlier events and filter them afterward.
- Apply the boundary before every calendar access: initial connection, scheduled sync, manual refresh, search, debugging, backfill, recurring-event expansion, and recovery. Never make an unbounded calendar request.
- Only events or recurring occurrences starting on or after this boundary are eligible. Do not retrieve earlier series history or master-event details as a workaround.
- Verify date-filter semantics before using an integration. An event-end-time filter may include events starting before the boundary and is insufficient by itself.
- If an integration cannot guarantee this access boundary, do not read the calendar through it. Explain the limitation and seek a compliant approach without relaxing the rule.
- Manual exercise entries and progress calculations must also start in September 2026 or later.
- Preserve this requirement in implementation documentation and handoffs. Only an explicit new user instruction can change it.

The user confirmed that no events start before September 1, 2026 and end afterward. Under that confirmed condition, Google's event-end-time `timeMin` filter at the boundary excludes earlier events. Every request must retain that boundary; the implementation also checks occurrence start times. This does not authorize retrieving earlier events if that condition changes.

## Read-only access and no actions on the user's behalf

- Calendar access is strictly READ ONLY, within the date boundary above, for the fitness dashboard only.
- NEVER create, edit, delete, move, or otherwise change calendar events, reminders, tasks, calendars, invitations, attendance responses, settings, sharing, or any other calendar data.
- NEVER send invitations, messages, notifications, emails, or other communications to people through the calendar or any other service as part of this project. Do not use calendar access as a means of contacting anyone.
- Do not seek alternatives or workarounds to perform these actions on the user's behalf, including other connectors, APIs, browser interactions, accounts, or services.
- Request only the minimum read-only calendar permissions needed. Do not request write permissions. If a connection requires write access or cannot meet these restrictions, stop and explain the limitation.
- Manually added exercises and goals belong only to the fitness tracker. Never write them back to Google Calendar or create corresponding reminders or notifications.
- Scheduled synchronization may only read permitted calendar data and update the tracker. It must not modify the calendar or contact anyone.
- Preserve these restrictions in future implementation documentation and handoffs. Only an explicit new user instruction can change them.
