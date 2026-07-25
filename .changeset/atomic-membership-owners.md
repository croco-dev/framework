---
"@croco/membership-core": minor
"@croco/membership-drizzle": minor
---

Serialize owner removal, demotion, and ownership transfer so concurrent membership mutations cannot leave a tenant without an owner, including stale role reads and repeatable-read transactions. Custom `MembershipStore` adapters must implement `mutateOwner()` and `transferOwnership()` with a transaction, lock, or compare-and-set and report serialization failures as `conflict`; validation-only `MembershipOwnerGuard` checks are now deprecated for write enforcement.
