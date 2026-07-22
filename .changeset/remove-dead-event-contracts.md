---
"@croco/events-core": minor
---

Remove the inert `EventOrdering` and `EventReplay` contract families so `@croco/events-core` no longer advertises configuration that no Croco runtime executes. There is no drop-in Croco replacement; consumers with custom ordering or replay implementations must define and verify both the contracts and behavior in their adapter packages.
