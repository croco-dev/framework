---
editUrl: false
next: false
prev: false
title: "TenantWorkspaceActionResult"
---

> **TenantWorkspaceActionResult** = \{ `kind`: `"idle"`; \} \| \{ `actionId`: `string`; `kind`: `"confirming"`; `requiredInput?`: [`TenantWorkspaceActionRequest`](/api/admin-react/src/type-aliases/tenantworkspaceactionrequest/)\[`"requiredInput"`\]; \} \| \{ `actionId`: `string`; `kind`: `"running"`; \} \| \{ `actionId`: `string`; `kind`: `"succeeded"`; `message?`: `string`; \} \| \{ `actionId`: `string`; `kind`: `"problem"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActionId?`: `string`; \}
