---
editUrl: false
next: false
prev: false
title: "CloudflareImagesDiagnosticsOptions"
---

> **CloudflareImagesDiagnosticsOptions** = `object`

Cloudflare Images 제공자 구성과 API 응답에 필요한 공개 타입들입니다.

## Properties

### readinessCheck()?

> `readonly` `optional` **readinessCheck**: (`context`) => `Promise`\<[`CloudflareImagesReadinessCheckResult`](/api/storage-cloudflare/src/type-aliases/cloudflareimagesreadinesscheckresult/) \| `void`\>

#### Parameters

##### context

[`CloudflareImagesReadinessCheckContext`](/api/storage-cloudflare/src/type-aliases/cloudflareimagesreadinesscheckcontext/)

#### Returns

`Promise`\<[`CloudflareImagesReadinessCheckResult`](/api/storage-cloudflare/src/type-aliases/cloudflareimagesreadinesscheckresult/) \| `void`\>
