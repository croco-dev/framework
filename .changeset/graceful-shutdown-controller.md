---
"@croco/transports-http": patch
---

Expose instance-bound graceful shutdown controllers so multiple HTTP apps in one process can shut down independently without sharing request rejection state.
