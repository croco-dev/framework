---
editUrl: false
next: false
prev: false
title: "FrontendEntitlementState"
---

> **FrontendEntitlementState** = \{ `checks?`: readonly [`FrontendEntitlementCheck`](/api/frontend-react/src/type-aliases/frontendentitlementcheck/)[]; `kind`: `"loading"`; `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \} \| \{ `checks`: readonly [`FrontendEntitlementCheck`](/api/frontend-react/src/type-aliases/frontendentitlementcheck/)[]; `grantedEntitlements`: readonly `string`[]; `kind`: `"allowed"`; \} \| \{ `checks`: readonly [`FrontendEntitlementCheck`](/api/frontend-react/src/type-aliases/frontendentitlementcheck/)[]; `kind`: `"denied"`; `missingEntitlements`: readonly `string`[]; `problem?`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \} \| \{ `checks?`: readonly [`FrontendEntitlementCheck`](/api/frontend-react/src/type-aliases/frontendentitlementcheck/)[]; `kind`: `"unavailable"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \}
