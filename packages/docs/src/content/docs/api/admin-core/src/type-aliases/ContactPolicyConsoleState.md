---
editUrl: false
next: false
prev: false
title: "ContactPolicyConsoleState"
---

> **ContactPolicyConsoleState** = `Readonly`\<\{ `kind`: `"loading"` \| `"empty"`; \}\> \| `Readonly`\<\{ `code`: `string`; `kind`: `"denied"` \| `"error"`; \}\> \| `Readonly`\<\{ `decision?`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `kind`: `"ready"` \| `"partial"`; `view`: [`ContactPolicyAdminView`](/api/admin-core/src/type-aliases/contactpolicyadminview/); \}\>
