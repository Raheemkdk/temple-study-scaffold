# Apple Calendar — web-compatible options

Apple EventKit is a native-platform framework, so a browser-only Next.js app should **not** promise direct EventKit access. A later release can offer a downloadable `.ics` event (one-time import) or a hosted subscription feed (read-only updates with refresh timing controlled by the Apple Calendar client). The team must decide which behavior students need and protect any private subscription URL. Neither option guarantees an app-scheduled 24/48-hour alert.

For the weekend, use Web Push where supported. On iOS/iPadOS, students need to add the web app to the Home Screen and grant notification permission. This keeps a single web codebase rather than adding a native Apple app.

- [Apple EventKit documentation](https://developer.apple.com/documentation/eventkit)
- [Apple Support: add calendar subscriptions](https://support.apple.com/en-us/102301)
- [WebKit: Web Push for Home Screen web apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
