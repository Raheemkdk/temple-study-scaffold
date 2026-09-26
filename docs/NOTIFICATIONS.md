# Reminder design

The student explicitly enables browser Web Push on each device. Subscribe via a service worker and store subscription data per user/device. On iOS/iPadOS, support requires a compatible Home Screen web app and notification permission. A test route should send an immediate message clearly labeled **test**.

For a timed, user-confirmed assignment, queue 48-hour and 24-hour jobs if those moments are still in the future. Use the due time's UTC instant; date-only entries have no timed job until the student supplies a time. Make job keys idempotent and include an assignment revision, device and offset. Cancel pending jobs after due-time edits or completion. The separate worker leases due jobs, sends with limited retries, expires late jobs, and records accepted/failed status. Provider acceptance does not prove the student saw a notification. Test with an injected clock and a fake push sender rather than waiting two days.

SMS is a later option, not part of this scaffold or weekend MVP. It would need opt-in, validated numbers, opt-out handling, provider configuration, deliverability checks, and a cost budget. Google/Apple calendar reminders are distinct from the app's Web Push; their behavior depends on those calendar clients.

- [WebKit: Web Push for web apps on iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
