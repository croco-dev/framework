---
"@croco/engagement-core": minor
"@croco/engagement-drizzle": minor
"@croco/admin-core": minor
"@croco/admin-react": minor
"@croco/problems-core": patch
---

Allow applications to opt into a scoped Contact Policy that atomically reserves customer contact budget across campaigns, preserves uncertain dispatches for reconciliation, and exposes audited policy management and dry-run decisions in the admin console.

The `engagement-core/contact-policy-acceptance-unknown` recovery contract requires verified provider evidence and explicit reconciliation; it does not permit automatic resend or budget refund.
