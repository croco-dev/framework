---
editUrl: false
next: false
prev: false
title: "EvidenceRef"
---

> **EvidenceRef** = `Readonly`\<\{ `id`: `string`; `observedWindow`: `Readonly`\<\{ `from`: `string`; `to`: `string`; \}\>; `snapshot?`: [`LearningResultSnapshot`](/api/admin-core/src/type-aliases/learningresultsnapshot/); `source`: `string`; `url?`: `string`; `version`: `string`; \}\>

Opaque source identity. Access state is resolved on reads and never trusted from a mutation.
