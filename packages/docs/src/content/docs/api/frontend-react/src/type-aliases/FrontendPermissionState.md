---
editUrl: false
next: false
prev: false
title: "FrontendPermissionState"
---

> **FrontendPermissionState** = \{ `checks?`: readonly [`FrontendPermissionCheck`](/api/frontend-react/src/type-aliases/frontendpermissioncheck/)[]; `kind`: `"loading"`; `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \} \| \{ `checks`: readonly [`FrontendPermissionCheck`](/api/frontend-react/src/type-aliases/frontendpermissioncheck/)[]; `grantedPermissions`: readonly `string`[]; `kind`: `"allowed"`; \} \| \{ `checks`: readonly [`FrontendPermissionCheck`](/api/frontend-react/src/type-aliases/frontendpermissioncheck/)[]; `kind`: `"denied"`; `missingPermissions`: readonly `string`[]; `problem?`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \} \| \{ `checks?`: readonly [`FrontendPermissionCheck`](/api/frontend-react/src/type-aliases/frontendpermissioncheck/)[]; `kind`: `"unavailable"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \}
