---
editUrl: false
next: false
prev: false
title: "RetryConsoleRecoveryResult"
---

> **RetryConsoleRecoveryResult** = \{ `action`: [`RetryConsoleRecoveryAction`](/api/admin-ops/src/type-aliases/retryconsolerecoveryaction/); `audit`: [`RetryConsoleAuditDescriptor`](/api/admin-ops/src/type-aliases/retryconsoleauditdescriptor/); `item`: [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/); `providerResult?`: `unknown`; `status`: `"succeeded"`; \} \| \{ `action?`: [`RetryConsoleRecoveryAction`](/api/admin-ops/src/type-aliases/retryconsolerecoveryaction/); `item?`: [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/); `problem`: [`RetryConsoleProblemMetadata`](/api/admin-ops/src/type-aliases/retryconsoleproblemmetadata/); `status`: `"denied"`; \} \| \{ `action`: [`RetryConsoleRecoveryAction`](/api/admin-ops/src/type-aliases/retryconsolerecoveryaction/); `item`: [`RetryConsoleItem`](/api/admin-ops/src/type-aliases/retryconsoleitem/); `problem`: [`RetryConsoleProblemMetadata`](/api/admin-ops/src/type-aliases/retryconsoleproblemmetadata/); `status`: `"failed"`; \}
