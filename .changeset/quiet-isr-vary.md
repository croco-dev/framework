---
"@croco/meta-vite": patch
---

Keep Vary-dependent responses out of shared ISR caching so HTML, Flight, language and encoding variants remain request-specific, including concurrent first fills and previously stored entries.
