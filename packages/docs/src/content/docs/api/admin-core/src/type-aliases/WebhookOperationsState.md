---
editUrl: false
next: false
prev: false
title: "WebhookOperationsState"
---

> **WebhookOperationsState** = \{ `kind`: `"loading"`; `tenantId`: `string`; \} \| \{ `kind`: `"empty"`; `message?`: `string`; `tenantId`: `string`; \} \| \{ `kind`: `"permission-denied"`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `requiredPermissions`: readonly `string`[]; `tenantId`: `string`; \} \| \{ `kind`: `"problem"`; `partial?`: [`WebhookOperationsReadyState`](/api/admin-core/src/type-aliases/webhookoperationsreadystate/); `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `tenantId`: `string`; \} \| \{ `endpointId`: `string`; `expiresAt?`: `Date`; `kind`: `"secret-created"`; `oneTimeSecret`: `string`; `secretVersion`: `string`; `tenantId`: `string`; \} \| [`WebhookOperationsReadyState`](/api/admin-core/src/type-aliases/webhookoperationsreadystate/)
