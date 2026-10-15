---
editUrl: false
next: false
prev: false
title: "learningRecordResource"
---

> `const` **learningRecordResource**: `object`

Host admin registries consume the same resource, permission and audit contract as other admin tools.

## Type Declaration

### actions

> `readonly` **actions**: readonly \[\{ `audit`: \{ `actor`: `"required"`; `eventName`: `"learning-record.saved"`; `idempotencyKey`: `"required"`; `reason`: `"required"`; `subjectIdField`: `"id"`; `subjectType`: `"learning-record"`; \}; `id`: `"save"`; `idempotency`: `"required"`; `kind`: `"edit"`; `label`: `"Save learning record"`; `mutability`: `"write"`; `permissions`: readonly \[\{ `permissions`: readonly \[`"learning:write"`\]; \}\]; `problems`: readonly \[\{ `code`: `"learning-registry/revision-conflict"`; `retryable`: `false`; \}, \{ `code`: `"learning-registry/idempotency-conflict"`; `retryable`: `false`; \}, \{ `code`: `"learning-registry/denied"`; \}\]; `target`: `"record"`; \}\]

### detail

> `readonly` **detail**: `object`

#### detail.fields

> `readonly` **fields**: readonly \[`"id"`, `"question"`, `"desiredOutcome"`, `"facts"`, `"hypotheses"`, `"evidenceRefs"`, `"decision"`, `"nextActions"`, `"tags"`, `"owner"`, `"status"`, `"revision"`\]

### fields

> `readonly` **fields**: readonly \[\{ `id`: `"id"`; `label`: `"Identity"`; `valueType`: `"string"`; \}, \{ `id`: `"question"`; `label`: `"Question"`; `sensitive`: `true`; `valueType`: `"string"`; \}, \{ `id`: `"desiredOutcome"`; `label`: `"Desired outcome"`; `sensitive`: `true`; `valueType`: `"string"`; \}, \{ `id`: `"facts"`; `label`: `"Observed facts"`; `sensitive`: `true`; `valueType`: `"json"`; \}, \{ `id`: `"hypotheses"`; `label`: `"Hypotheses and limits"`; `sensitive`: `true`; `valueType`: `"json"`; \}, \{ `id`: `"evidenceRefs"`; `label`: `"Evidence references"`; `sensitive`: `true`; `valueType`: `"json"`; \}, \{ `id`: `"decision"`; `label`: `"Decision"`; `sensitive`: `true`; `valueType`: `"json"`; \}, \{ `id`: `"nextActions"`; `label`: `"Next actions"`; `sensitive`: `true`; `valueType`: `"json"`; \}, \{ `id`: `"tags"`; `label`: `"Action / target / metric tags"`; `sensitive`: `true`; `valueType`: `"json"`; \}, \{ `id`: `"owner"`; `label`: `"Owner"`; `sensitive`: `true`; `valueType`: `"string"`; \}, \{ `id`: `"status"`; `label`: `"Review status"`; `valueType`: `"status"`; \}, \{ `id`: `"revision"`; `label`: `"Revision"`; `valueType`: `"number"`; \}\]

### identity

> `readonly` **identity**: `object`

#### identity.idField

> `readonly` **idField**: `"id"` = `"id"`

#### identity.labelField

> `readonly` **labelField**: `"question"` = `"question"`

#### identity.statusField

> `readonly` **statusField**: `"status"` = `"status"`

#### identity.versionField

> `readonly` **versionField**: `"revision"` = `"revision"`

### kind

> `readonly` **kind**: `"learning-record"` = `"learning-record"`

### label

> `readonly` **label**: `"Learning records"` = `"Learning records"`

### list

> `readonly` **list**: `object`

#### list.fields

> `readonly` **fields**: readonly \[`"question"`, `"status"`, `"revision"`\]

#### list.pageSize

> `readonly` **pageSize**: `20` = `20`

### scope

> `readonly` **scope**: `"tenant"` = `"tenant"`

### source

> `readonly` **source**: `"croco"` = `"croco"`
