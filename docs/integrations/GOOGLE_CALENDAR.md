# Google Calendar API — future option

For actual Google Calendar integration, the student must authorize the app through Google OAuth. Request only the needed scopes, store refresh tokens encrypted, and use a dedicated app calendar or stable event IDs so repeated updates do not duplicate entries. Map due-time changes and deletions, define timezones, and give users disconnect/delete controls. OAuth consent setup and review can take longer than a weekend; this is intentionally **not implemented**.

An event can carry Google Calendar reminder settings, but client/calendar behavior is separate from this app's browser push worker. Google Calendar's watch endpoint concerns changes to calendar resources; it is not a device push notification for students.

- [Google Calendar authorization and scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Create events](https://developers.google.com/workspace/calendar/api/guides/create-events)
- [Events resource and reminders](https://developers.google.com/workspace/calendar/api/v3/reference/events)
