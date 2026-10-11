---
"@croco/metering-core": patch
---

Prevent in-flight tenant cache refreshes from overwriting subsequent meter registrations or repopulating cleared or reloaded caches. Superseded refresh callers receive the current cache snapshot.
