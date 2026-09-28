---
editUrl: false
next: false
prev: false
title: "PlacementEvaluation"
---

> **PlacementEvaluation** = `Readonly`\<\{ `decision`: [`ExperienceDecision`](/api/experience-core/src/type-aliases/experiencedecision/); `exposureHandle`: [`ExposureHandle`](/api/experience-core/src/type-aliases/exposurehandle/); `reason`: `"selected"`; \} \| \{ `decision`: `null`; `detail`: `"no_candidate"` \| `"reservation_rejected"`; `exposureHandle?`: `never`; `reason`: `"no_match"`; \} \| \{ `decision`: `null`; `exposureHandle?`: `never`; `reason`: `"unavailable"`; \}\>
