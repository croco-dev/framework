---
editUrl: false
next: false
prev: false
title: "HttpStatus"
---

> `const` **HttpStatus**: `object`

Defined in: [packages/problems-core/src/libs/HttpStatus.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/problems-core/src/libs/HttpStatus.ts#L13)

HTTP 상태 코드 상수입니다.

## Type Declaration

### ACCEPTED

> `readonly` **ACCEPTED**: `202` = `202`

### BAD\_GATEWAY

> `readonly` **BAD\_GATEWAY**: `502` = `502`

### BAD\_REQUEST

> `readonly` **BAD\_REQUEST**: `400` = `400`

### CONFLICT

> `readonly` **CONFLICT**: `409` = `409`

### CONTINUE

> `readonly` **CONTINUE**: `100` = `100`

### CREATED

> `readonly` **CREATED**: `201` = `201`

### EARLY\_HINTS

> `readonly` **EARLY\_HINTS**: `103` = `103`

### EXPECTATION\_FAILED

> `readonly` **EXPECTATION\_FAILED**: `417` = `417`

### FAILED\_DEPENDENCY

> `readonly` **FAILED\_DEPENDENCY**: `424` = `424`

### FORBIDDEN

> `readonly` **FORBIDDEN**: `403` = `403`

### FOUND

> `readonly` **FOUND**: `302` = `302`

### GATEWAY\_TIMEOUT

> `readonly` **GATEWAY\_TIMEOUT**: `504` = `504`

### GONE

> `readonly` **GONE**: `410` = `410`

### HTTP\_VERSION\_NOT\_SUPPORTED

> `readonly` **HTTP\_VERSION\_NOT\_SUPPORTED**: `505` = `505`

### IM\_A\_TEAPOT

> `readonly` **IM\_A\_TEAPOT**: `418` = `418`

### INSUFFICIENT\_STORAGE

> `readonly` **INSUFFICIENT\_STORAGE**: `507` = `507`

### INTERNAL\_SERVER\_ERROR

> `readonly` **INTERNAL\_SERVER\_ERROR**: `500` = `500`

### LENGTH\_REQUIRED

> `readonly` **LENGTH\_REQUIRED**: `411` = `411`

### LOCKED

> `readonly` **LOCKED**: `423` = `423`

### LOOP\_DETECTED

> `readonly` **LOOP\_DETECTED**: `508` = `508`

### METHOD\_NOT\_ALLOWED

> `readonly` **METHOD\_NOT\_ALLOWED**: `405` = `405`

### MOVED\_PERMANENTLY

> `readonly` **MOVED\_PERMANENTLY**: `301` = `301`

### MULTIPLE\_CHOICES

> `readonly` **MULTIPLE\_CHOICES**: `300` = `300`

### NETWORK\_AUTHENTICATION\_REQUIRED

> `readonly` **NETWORK\_AUTHENTICATION\_REQUIRED**: `511` = `511`

### NO\_CONTENT

> `readonly` **NO\_CONTENT**: `204` = `204`

### NON\_AUTHORITATIVE\_INFORMATION

> `readonly` **NON\_AUTHORITATIVE\_INFORMATION**: `203` = `203`

### NOT\_ACCEPTABLE

> `readonly` **NOT\_ACCEPTABLE**: `406` = `406`

### NOT\_EXTENDED

> `readonly` **NOT\_EXTENDED**: `510` = `510`

### NOT\_FOUND

> `readonly` **NOT\_FOUND**: `404` = `404`

### NOT\_IMPLEMENTED

> `readonly` **NOT\_IMPLEMENTED**: `501` = `501`

### NOT\_MODIFIED

> `readonly` **NOT\_MODIFIED**: `304` = `304`

### OK

> `readonly` **OK**: `200` = `200`

### PARTIAL\_CONTENT

> `readonly` **PARTIAL\_CONTENT**: `206` = `206`

### PAYLOAD\_TOO\_LARGE

> `readonly` **PAYLOAD\_TOO\_LARGE**: `413` = `413`

### PAYMENT\_REQUIRED

> `readonly` **PAYMENT\_REQUIRED**: `402` = `402`

### PERMANENT\_REDIRECT

> `readonly` **PERMANENT\_REDIRECT**: `308` = `308`

### PRECONDITION\_FAILED

> `readonly` **PRECONDITION\_FAILED**: `412` = `412`

### PRECONDITION\_REQUIRED

> `readonly` **PRECONDITION\_REQUIRED**: `428` = `428`

### PROCESSING

> `readonly` **PROCESSING**: `102` = `102`

### PROXY\_AUTHENTICATION\_REQUIRED

> `readonly` **PROXY\_AUTHENTICATION\_REQUIRED**: `407` = `407`

### RANGE\_NOT\_SATISFIABLE

> `readonly` **RANGE\_NOT\_SATISFIABLE**: `416` = `416`

### REQUEST\_HEADER\_FIELDS\_TOO\_LARGE

> `readonly` **REQUEST\_HEADER\_FIELDS\_TOO\_LARGE**: `431` = `431`

### REQUEST\_TIMEOUT

> `readonly` **REQUEST\_TIMEOUT**: `408` = `408`

### RESET\_CONTENT

> `readonly` **RESET\_CONTENT**: `205` = `205`

### SEE\_OTHER

> `readonly` **SEE\_OTHER**: `303` = `303`

### SERVICE\_UNAVAILABLE

> `readonly` **SERVICE\_UNAVAILABLE**: `503` = `503`

### SWITCHING\_PROTOCOLS

> `readonly` **SWITCHING\_PROTOCOLS**: `101` = `101`

### TEMPORARY\_REDIRECT

> `readonly` **TEMPORARY\_REDIRECT**: `307` = `307`

### TOO\_EARLY

> `readonly` **TOO\_EARLY**: `425` = `425`

### TOO\_MANY\_REQUESTS

> `readonly` **TOO\_MANY\_REQUESTS**: `429` = `429`

### UNAUTHORIZED

> `readonly` **UNAUTHORIZED**: `401` = `401`

### UNAVAILABLE\_FOR\_LEGAL\_REASONS

> `readonly` **UNAVAILABLE\_FOR\_LEGAL\_REASONS**: `451` = `451`

### UNPROCESSABLE\_ENTITY

> `readonly` **UNPROCESSABLE\_ENTITY**: `422` = `422`

### UNSUPPORTED\_MEDIA\_TYPE

> `readonly` **UNSUPPORTED\_MEDIA\_TYPE**: `415` = `415`

### UPGRADE\_REQUIRED

> `readonly` **UPGRADE\_REQUIRED**: `426` = `426`

### URI\_TOO\_LONG

> `readonly` **URI\_TOO\_LONG**: `414` = `414`

### VARIANT\_ALSO\_NEGOTIATES

> `readonly` **VARIANT\_ALSO\_NEGOTIATES**: `506` = `506`

## Example

```typescript
import { HttpStatus } from '@croco/problems-core';

if (response.status === HttpStatus.PAYLOAD_TOO_LARGE) {
  // 처리 로직
}
```
