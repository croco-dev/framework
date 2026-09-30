---
editUrl: false
next: false
prev: false
title: "PolicyReleaseAdminSnapshot"
---

> **PolicyReleaseAdminSnapshot** = `Readonly`\<\{ `diagnostics`: readonly `Pick`\<[`PolicyValidationDiagnostic`](/api/features-core/src/type-aliases/policyvalidationdiagnostic/), `"code"` \| `"path"` \| `"severity"`\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly `Readonly`\<\{ `input`: [`PolicyFieldInput`](/api/features-core/src/type-aliases/policyfieldinput/); `key`: `string`; `label`: `string`; `max?`: `number`; `min?`: `number`; `options?`: readonly `Readonly`\<\{ `label`: `string`; `value`: `string`; \}\>[]; `sensitive`: `boolean`; `value`: `unknown`; \}\>[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\>
