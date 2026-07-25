---
"@croco/invitation-core": patch
---

Reject malformed email addresses before domain-policy lookup so multiple separators, empty segments, and whitespace cannot trigger automatic membership or audit events.
