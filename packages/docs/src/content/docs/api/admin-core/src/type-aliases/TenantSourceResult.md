---
editUrl: false
next: false
prev: false
title: "TenantSourceResult"
---

> **TenantSourceResult**\<`TState`\> = \{ `expiresAt?`: `Date`; `kind`: `"ready"`; `loadedAt`: `Date`; `state`: `TState`; \} \| \{ `kind`: `"empty"`; `loadedAt`: `Date`; `message?`: `string`; \} \| \{ `kind`: `"stale"`; `loadedAt`: `Date`; `problem?`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `staleAt`: `Date`; `state`: `TState`; \} \| \{ `grantedPermissions`: readonly `string`[]; `kind`: `"permission-denied"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `requiredPermissions`: readonly `string`[]; \} \| \{ `kind`: `"unavailable"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `retryable`: `boolean`; \} \| \{ `kind`: `"problem"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`TenantWorkspaceAction`](/api/admin-core/src/type-aliases/tenantworkspaceaction/)[]; \}

## Type Parameters

### TState

`TState`
