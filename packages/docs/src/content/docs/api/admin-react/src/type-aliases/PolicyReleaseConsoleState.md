---
editUrl: false
next: false
prev: false
title: "PolicyReleaseConsoleState"
---

> **PolicyReleaseConsoleState** = `Readonly`\<\{ `kind`: `"loading"`; \}\> \| `Readonly`\<\{ `code`: `string`; `kind`: `"denied"`; `message`: `string`; \}\> \| `Readonly`\<\{ `code`: `string`; `kind`: `"error"`; `message`: `string`; \}\> \| `Readonly`\<\{ `code`: `string`; `kind`: `"partial"`; `message`: `string`; \}\> \| `Readonly`\<\{ `kind`: `"empty"`; \}\> \| `Readonly`\<\{ `canPublish`: `boolean`; `canReview`: `boolean`; `canWrite`: `boolean`; `diagnostics`: readonly `Readonly`\<\{ `code`: `string`; `path`: `string`; `severity`: `"error"` \| `"warning"`; \}\>[]; `diff`: readonly `Readonly`\<\{ `after`: `string`; `before`: `string`; `field`: `string`; \}\>[]; `fields`: readonly [`PolicyReleaseConsoleField`](/api/admin-react/src/type-aliases/policyreleaseconsolefield/)[]; `impact`: readonly `Readonly`\<\{ `kind`: `"fact"` \| `"estimate"` \| `"insufficient-data"`; `message`: `string`; \}\>[]; `kind`: `"ready"`; `policyId`: `string`; `receipt?`: `Readonly`\<\{ `id`: `string`; `revision`: `number`; `status`: `string`; \}\>; `reviewHash?`: `string`; `reviewRequirements?`: `Readonly`\<\{ `independentReviewer`: `boolean`; `risk`: `"low"` \| `"financial"`; \}\>; `revision`: `number`; `status`: `string`; \}\>
