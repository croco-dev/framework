---
editUrl: false
next: false
prev: false
title: "R2Options"
---

> **R2Options** = `object`

Cloudflare R2 제공자 생성에 필요한 설정입니다.

## Properties

### accessKeyId

> **accessKeyId**: `string`

R2 Access Key ID

***

### accountId

> **accountId**: `string`

Cloudflare Account ID

***

### bucket

> **bucket**: `string`

R2 버킷 이름

***

### publicUrlBase?

> `optional` **publicUrlBase?**: `string`

공개 URL 기본 경로 (선택)

Custom domain을 사용하는 경우 설정합니다.
예: 'https://cdn.example.com'

설정하지 않으면 R2의 기본 퍼블릭 URL을 사용합니다:
`https://{bucket}.{accountId}.r2.dev`

***

### secretAccessKey

> **secretAccessKey**: `string`

R2 Secret Access Key
