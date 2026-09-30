---
editUrl: false
next: false
prev: false
title: "ContactEndpointInvalidationResult"
---

> **ContactEndpointInvalidationResult** = `Readonly`\<\{ `endpoint`: [`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/); `status`: `"invalidated"`; \}\> \| `Readonly`\<\{ `endpoint`: [`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/); `status`: `"already-invalid"`; \}\> \| `Readonly`\<\{ `endpoint`: [`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/); `status`: `"version-mismatch"`; \}\> \| `Readonly`\<\{ `endpoint`: [`ContactEndpoint`](/api/engagement-core/src/type-aliases/contactendpoint/); `status`: `"freshness-mismatch"`; \}\> \| `Readonly`\<\{ `status`: `"not-found"`; \}\>
