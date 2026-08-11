---
editUrl: false
next: false
prev: false
title: "TestEvidenceRecord"
---

> **TestEvidenceRecord** = `object`

## Properties

### attachments

> `readonly` **attachments**: readonly [`TestEvidenceAttachment`](/api/testing/src/type-aliases/testevidenceattachment/)[]

***

### attempts

> `readonly` **attempts**: readonly [`TestEvidenceAttempt`](/api/testing/src/type-aliases/testevidenceattempt/)[]

***

### diagnostics

> `readonly` **diagnostics**: readonly [`TestEvidenceDiagnostic`](/api/testing/src/type-aliases/testevidencediagnostic/)[]

***

### fidelity

> `readonly` **fidelity**: [`TestEvidenceFidelity`](/api/testing/src/type-aliases/testevidencefidelity/)

***

### id

> `readonly` **id**: `string`

***

### intent

> `readonly` **intent**: [`TestEvidenceIntent`](/api/testing/src/type-aliases/testevidenceintent/)

***

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, [`TestEvidenceJsonValue`](/api/testing/src/type-aliases/testevidencejsonvalue/)\>\>

***

### observed

> `readonly` **observed**: [`TestEvidenceObservation`](/api/testing/src/type-aliases/testevidenceobservation/)

***

### outcome

> `readonly` **outcome**: [`TestEvidenceOutcome`](/api/testing/src/type-aliases/testevidenceoutcome/)

***

### packageName?

> `readonly` `optional` **packageName?**: `string`

***

### replay

> `readonly` **replay**: [`TestEvidenceReplay`](/api/testing/src/type-aliases/testevidencereplay/)

***

### resources

> `readonly` **resources**: [`TestEvidenceResourceStatus`](/api/testing/src/type-aliases/testevidenceresourcestatus/)

***

### runner

> `readonly` **runner**: [`TestEvidenceRunner`](/api/testing/src/type-aliases/testevidencerunner/)

***

### schemaVersion

> `readonly` **schemaVersion**: *typeof* [`TEST_EVIDENCE_SCHEMA_VERSION`](/api/testing/src/variables/test_evidence_schema_version/)

***

### timing?

> `readonly` `optional` **timing?**: [`TestEvidenceTiming`](/api/testing/src/type-aliases/testevidencetiming/)
