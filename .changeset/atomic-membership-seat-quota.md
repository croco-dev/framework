---
"@croco/membership-core": major
"@croco/membership-drizzle": major
---

Membership add commands now carry the finite seat capacity enforced by the store's atomic command
transaction. Custom `MembershipStore` implementations must reject an add whose non-null `maxSeats`
is already consumed; `null` preserves unlimited membership creation. Drizzle deployments must apply
`addMembershipSeatOrdinals()` before using the new command path.
