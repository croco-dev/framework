---
editUrl: false
next: false
prev: false
title: "FrontendTenantState"
---

> **FrontendTenantState** = \{ `kind`: `"loading"`; `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \} \| \{ `kind`: `"available"`; `tenant`: [`FrontendTenant`](/api/frontend-react/src/type-aliases/frontendtenant/); \} \| \{ `kind`: `"missing"`; `problem?`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \} \| \{ `kind`: `"unavailable"`; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); `recoveryActions?`: readonly [`FrontendRecoveryAction`](/api/frontend-react/src/type-aliases/frontendrecoveryaction/)[]; \}
