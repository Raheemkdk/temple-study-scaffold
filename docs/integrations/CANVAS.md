# Temple Canvas iCalendar

**MVP technique:** the student pastes their own private `https://templeu.instructure.com/feeds/calendars/user_<token>.ics` URL into the app. The server makes a manual HTTPS request after validating exact hostname, path and scheme. Refuse redirects; cap response size and time; store the URL encrypted at rest. Parse VEVENT entries, including UID/recurrence and timezone/date-only information. Deduplicate imports and revision deadlines when changed. Show the student the last successful sync and allow refresh. Confirm which feed items represent actual due assignments before scheduling reminders, because a Canvas feed also includes other events.

The feed may expose event titles and due times, but is **not** a gradebook or proof of submission. Treat the URL as a credential. Do not proxy arbitrary pasted URLs, print tokens in logs, or put real feeds into tests. Use a synthetic `.ics` fixture created by the team.

- [Canvas official guide: view the Calendar iCal feed](https://community.instructure.com/en/kb/articles/662804-how-do-i-view-the-calendar-ical-feed-to-import-and-subscribe-to-an-external-calendar)
- [RFC 5545 iCalendar format](https://www.rfc-editor.org/rfc/rfc5545)
