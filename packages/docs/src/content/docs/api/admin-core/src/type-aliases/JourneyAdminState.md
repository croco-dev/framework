---
editUrl: false
next: false
prev: false
title: "JourneyAdminState"
---

> **JourneyAdminState** = \{ `kind`: `"loading"` \| `"empty"`; \} \| \{ `code`: `string`; `kind`: `"denied"` \| `"error"`; \} \| \{ `episodes`: readonly [`JourneyEpisodeView`](/api/admin-core/src/type-aliases/journeyepisodeview/)[]; `kind`: `"ready"`; \}
