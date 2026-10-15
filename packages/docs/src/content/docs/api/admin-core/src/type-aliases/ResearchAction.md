---
editUrl: false
next: false
prev: false
title: "ResearchAction"
---

> **ResearchAction** = `Readonly`\<\{ `kind`: `"select"`; \}\> \| `Readonly`\<\{ `kind`: `"invite"` \| `"participated"`; `subject`: `string`; \}\> \| `Readonly`\<\{ `contact`: `boolean`; `kind`: `"consent"`; `participation`: `boolean`; `subject`: `string`; \}\> \| `Readonly`\<\{ `kind`: `"response"`; `response`: `"accepted"` \| `"declined"` \| `"withdrawn"`; `subject`: `string`; \}\> \| `Readonly`\<\{ `kind`: `"note"`; `subject`: `string`; `text`: `string` \| `null`; \}\> \| `Readonly`\<\{ `kind`: `"reconcile"`; `outcome`: `"invited"` \| `"suppressed"`; `subject`: `string`; \}\>
