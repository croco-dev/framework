---
editUrl: false
next: false
prev: false
title: "AdminActionPermissionDecision"
---

> **AdminActionPermissionDecision** = \{ `action`: [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/); `kind`: `"allowed"`; \} \| \{ `action`: [`AdminActionContract`](/api/admin-react/src/type-aliases/adminactioncontract/); `kind`: `"denied"`; `missingPermissions`: readonly `string`[]; `problem`: [`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/); \}
