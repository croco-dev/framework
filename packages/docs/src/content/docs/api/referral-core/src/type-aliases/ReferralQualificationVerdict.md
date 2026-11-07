---
editUrl: false
next: false
prev: false
title: "ReferralQualificationVerdict"
---

> **ReferralQualificationVerdict** = \{ `eligibleReason`: `string`; `qualified`: `true`; `qualifyingAction`: `string`; `sourceEventId`: `string`; \} \| \{ `qualified`: `false`; `reason`: `string`; \}

Authoritative qualification evidence supplied by the app's own action source.

## Union Members

### Type Literal

\{ `eligibleReason`: `string`; `qualified`: `true`; `qualifyingAction`: `string`; `sourceEventId`: `string`; \}

#### eligibleReason

> `readonly` **eligibleReason**: `string`

Non-blank explanation of the confirmed eligibility.

#### qualified

> `readonly` **qualified**: `true`

#### qualifyingAction

> `readonly` **qualifyingAction**: `string`

Must exactly match the attribution's pinned program version.

#### sourceEventId

> `readonly` **sourceEventId**: `string`

Non-blank event identity from the authoritative action source.

---

### Type Literal

\{ `qualified`: `false`; `reason`: `string`; \}
