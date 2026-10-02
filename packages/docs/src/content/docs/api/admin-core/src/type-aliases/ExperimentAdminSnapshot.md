---
editUrl: false
next: false
prev: false
title: "ExperimentAdminSnapshot"
---

> **ExperimentAdminSnapshot** = `Readonly`\<\{ `canConfigure`: `boolean`; `canOperate`: `boolean`; `canPreview`: `boolean`; `definition`: `Omit`\<[`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/), `"salt"`\>; `eligibilityOptions`: readonly `string`[]; `samples`: readonly `Readonly`\<\{ `id`: `string`; `label`: `string`; \}\>[]; `state`: [`ExperimentRecord`](/api/features-core/src/type-aliases/experimentrecord/)\[`"state"`\]; `target`: [`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/); `version`: `number`; \}\>
