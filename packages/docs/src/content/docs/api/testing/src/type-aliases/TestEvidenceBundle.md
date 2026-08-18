---
editUrl: false
next: false
prev: false
title: "TestEvidenceBundle"
---

> **TestEvidenceBundle** = `object`

## Properties

### missingArtifacts

> `readonly` **missingArtifacts**: readonly [`TestEvidenceMissingArtifact`](/api/testing/src/type-aliases/testevidencemissingartifact/)[]

---

### records

> `readonly` **records**: readonly [`TestEvidenceRecord`](/api/testing/src/type-aliases/testevidencerecord/)[]

---

### schemaVersion

> `readonly` **schemaVersion**: _typeof_ [`TEST_EVIDENCE_SCHEMA_VERSION`](/api/testing/src/variables/test_evidence_schema_version/)

---

### status

> `readonly` **status**: `"passed"` \| `"failed"`

---

### summary

> `readonly` **summary**: `object`

#### failed

> `readonly` **failed**: `number`

#### flaky

> `readonly` **flaky**: `number`

#### passed

> `readonly` **passed**: `number`

#### skipped

> `readonly` **skipped**: `number`

#### total

> `readonly` **total**: `number`
