---
"@croco/gid-core": minor
"@croco/problems-core": patch
---

Keep `defineIdPrefixes()` registries safe to inspect by replacing the throwing `Id` property with the type-only `IdOf<TEntry>` helper.

Migrate `typeof Ids.USER.Id` to `IdOf<typeof Ids.USER>`. The retired `gid-core/id-type-only-property` Problem code remains registered as deprecated migration metadata.
