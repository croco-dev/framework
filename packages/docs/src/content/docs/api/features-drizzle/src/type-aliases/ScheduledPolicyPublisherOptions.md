---
editUrl: false
next: false
prev: false
title: "ScheduledPolicyPublisherOptions"
---

> **ScheduledPolicyPublisherOptions**\<`TValue`\> = `Readonly`\<\{ `executionManager`: [`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/); `leaseMs?`: `number`; `now?`: () => `Date`; `store`: [`PolicyScheduleLookup`](/api/features-core/src/interfaces/policyschedulelookup/)\<`TValue`\>; `triggerDispatcher?`: [`PolicyTriggerDispatcher`](/api/features-drizzle/src/type-aliases/policytriggerdispatcher/); `workerId?`: `string`; `publish`: `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>; \}\>

## Type Parameters

### TValue

`TValue` = `unknown`
