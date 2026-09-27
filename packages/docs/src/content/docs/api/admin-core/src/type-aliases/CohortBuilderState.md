---
editUrl: false
next: false
prev: false
title: "CohortBuilderState"
---

> **CohortBuilderState** = `Readonly`\<\{ `kind`: `"loading"`; \}\> \| `Readonly`\<\{ `code`: `string`; `kind`: `"denied"` \| `"failed"`; \}\> \| `Readonly`\<\{ `history`: readonly [`CohortAdminHistory`](/api/admin-core/src/type-aliases/cohortadminhistory/)[]; `kind`: `"ready"`; `preview?`: [`CohortAdminPreview`](/api/admin-core/src/type-aliases/cohortadminpreview/); \}\>
