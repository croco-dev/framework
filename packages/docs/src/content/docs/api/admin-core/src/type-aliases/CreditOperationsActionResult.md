---
editUrl: false
next: false
prev: false
title: "CreditOperationsActionResult"
---

> **CreditOperationsActionResult** = \{ `kind`: `"succeeded"`; `ledgerPosition`: `number`; `replayed`: `boolean`; `transactionIds`: readonly `string`[]; \} \| \{ `kind`: `"problem"`; `ledgerCommitted?`: `boolean`; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); `recovery`: `"change-input"` \| `"refresh-ledger"` \| `"reuse-idempotency-result"` \| `"retry-event-publication"`; \}
