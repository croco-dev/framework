---
editUrl: false
next: false
prev: false
title: "FactHistoryOperations"
---

Implementations call the canonical fact service with a server-authenticated principal.

## Methods

### compare()

> **compare**(`request`): `Promise`\<[`FactHistoryState`](/api/admin-core/src/type-aliases/facthistorystate/)\>

#### Parameters

##### request

[`FactHistoryComparisonRequest`](/api/admin-core/src/type-aliases/facthistorycomparisonrequest/)

#### Returns

`Promise`\<[`FactHistoryState`](/api/admin-core/src/type-aliases/facthistorystate/)\>

---

### correct()

> **correct**(`request`): `Promise`\<\{ `auditId`: `string`; `revision`: `number`; \}\>

#### Parameters

##### request

[`FactHistoryCorrectionRequest`](/api/admin-core/src/type-aliases/facthistorycorrectionrequest/)

#### Returns

`Promise`\<\{ `auditId`: `string`; `revision`: `number`; \}\>
