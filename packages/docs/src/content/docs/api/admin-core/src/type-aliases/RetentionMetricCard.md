---
editUrl: false
next: false
prev: false
title: "RetentionMetricCard"
---

> **RetentionMetricCard** = `Omit`\<[`BehaviorMetricResult`](/api/metrics-core/src/type-aliases/behaviormetricresult/), `"subjects"` \| `"sourceRefs"`\> & `object`

## Type Declaration

### baselineWindow?

> `optional` **baselineWindow?**: `object`

#### baselineWindow.from

> **from**: `string`

#### baselineWindow.to

> **to**: `string`

### buckets?

> `optional` **buckets?**: [`BehaviorFrequencyResult`](/api/metrics-core/src/type-aliases/behaviorfrequencyresult/)\[`"buckets"`\]

### id

> **id**: `string`

### kind

> **kind**: [`RetentionMetricSelection`](/api/admin-core/src/type-aliases/retentionmetricselection/)\[`"kind"`\]

### measure?

> `optional` **measure?**: [`BehaviorFrequencyResult`](/api/metrics-core/src/type-aliases/behaviorfrequencyresult/)\[`"measure"`\]

### sources

> **sources**: readonly `string`[]
