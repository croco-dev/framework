---
"@croco/metering-core": patch
---

Preserve usage IDs containing colons, Unicode and percent sequences in Redis reads, quota totals and flush deletion. New v3 members coexist with valid legacy and v2 records; ambiguous or malformed stored members raise a Redis Problem instead of changing the amount. Reject unpaired Unicode surrogates and JSON payloads deeper than 1,000 object/array levels before writes. Quota parsing uses isolated Lua CJSON controls without changing shared decoder settings. Mixed-version logical duplicates count once in reads and quota checks; conflicting values or timestamps fail before quota writes. Coordinate all shared-namespace readers before resuming v3 writers; older readers cannot consume the new format and ambiguous existing records require reconciliation with an authoritative source.
