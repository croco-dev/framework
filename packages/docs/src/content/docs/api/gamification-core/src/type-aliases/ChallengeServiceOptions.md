---
editUrl: false
next: false
prev: false
title: "ChallengeServiceOptions"
---

> **ChallengeServiceOptions** = `Readonly`\<\{ `authorize`: (`access`, `action`) => `Promise`\<`boolean`\>; `clock`: () => `Date`; `isMember`: (`access`) => `Promise`\<`boolean`\>; `sources`: `Readonly`\<`Record`\<`string`, (`access`, `eventId`) => `Promise`\<[`ChallengeEvidence`](/api/gamification-core/src/type-aliases/challengeevidence/)\>\>\>; `store`: [`ChallengeStore`](/api/gamification-core/src/interfaces/challengestore/); \}\>
