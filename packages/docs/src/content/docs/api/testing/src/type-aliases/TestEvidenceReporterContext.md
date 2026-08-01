---
editUrl: false
next: false
prev: false
title: "TestEvidenceReporterContext"
---

> **TestEvidenceReporterContext** = \{ `diagnostic?`: \{ `duration`: `number`; `flaky`: `boolean`; `retryCount`: `number`; \}; `fullName`: `string`; `id`: `string`; `name`: `string`; `runner`: `"vitest"`; `source`: [`VitestTask`](/api/testing/src/type-aliases/vitesttask/); `state`: `"failed"` \| `"passed"` \| `"skipped"`; \} \| \{ `expectedStatus`: [`PlaywrightTestResult`](/api/testing/src/type-aliases/playwrighttestresult/)\[`"status"`\]; `id`: `string`; `results`: readonly [`PlaywrightTestResult`](/api/testing/src/type-aliases/playwrighttestresult/)[]; `runner`: `"playwright"`; `source`: \{ `results`: readonly [`PlaywrightTestResult`](/api/testing/src/type-aliases/playwrighttestresult/)[]; `test`: [`PlaywrightTestCase`](/api/testing/src/type-aliases/playwrighttestcase/); \}; `title`: `string`; `titlePath`: readonly `string`[]; \}
