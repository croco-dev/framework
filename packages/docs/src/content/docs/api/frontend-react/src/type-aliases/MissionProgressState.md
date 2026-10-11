---
editUrl: false
next: false
prev: false
title: "MissionProgressState"
---

> **MissionProgressState** = `Readonly`\<\{ `kind`: `"loading"` \| `"empty"`; \}\> \| `Readonly`\<\{ `kind`: `"denied"` \| `"error"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `kind`: `"partial"` \| `"ready"`; `message?`: `string`; `progress`: [`MissionProgress`](/api/gamification-core/src/type-aliases/missionprogress/); \}\>
