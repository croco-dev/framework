---
editUrl: false
next: false
prev: false
title: "dimension"
---

> `const` **dimension**: `Readonly`\<\{ `enum`: [`EnumDimension`](/api/metering-core/src/type-aliases/enumdimension/)\<`TValues`\>; \}\>

Definition-first meter helpers and deterministic meter descriptors.

## Description

`defineMeter` preserves literal meter keys, aggregations, billing intent, and declared dimension domains.
The returned branded `MeterRef` can be passed to `MeteringService.record`.
