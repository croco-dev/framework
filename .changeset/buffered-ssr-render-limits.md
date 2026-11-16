---
"@croco/meta-vite": patch
---

Apply the SSR deadline and request cancellation to pages without deferred regions. The deadline includes shell resolution and component loading. On Lambda, reject HTML that exceeds the buffered response limit, including the document head.

Live ISR waiters can share one replacement cache attempt when the original fill request disconnects. They only share cacheable results; a replacement response specific to one request stays with that request.
