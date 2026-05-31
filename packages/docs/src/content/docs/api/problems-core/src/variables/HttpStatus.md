---
editUrl: false
next: false
prev: false
title: "HttpStatus"
---

> `const` **HttpStatus**: `object`

HTTP 상태 코드 상수입니다.

## Type Declaration

### ACCEPTED

> `readonly` **ACCEPTED**: `202` = `202`

### BAD_GATEWAY

> `readonly` **BAD_GATEWAY**: `502` = `502`

### BAD_REQUEST

> `readonly` **BAD_REQUEST**: `400` = `400`

### CONFLICT

> `readonly` **CONFLICT**: `409` = `409`

### CONTINUE

> `readonly` **CONTINUE**: `100` = `100`

### CREATED

> `readonly` **CREATED**: `201` = `201`

### EARLY_HINTS

> `readonly` **EARLY_HINTS**: `103` = `103`

### EXPECTATION_FAILED

> `readonly` **EXPECTATION_FAILED**: `417` = `417`

### FAILED_DEPENDENCY

> `readonly` **FAILED_DEPENDENCY**: `424` = `424`

### FORBIDDEN

> `readonly` **FORBIDDEN**: `403` = `403`

### FOUND

> `readonly` **FOUND**: `302` = `302`

### GATEWAY_TIMEOUT

> `readonly` **GATEWAY_TIMEOUT**: `504` = `504`

### GONE

> `readonly` **GONE**: `410` = `410`

### HTTP_VERSION_NOT_SUPPORTED

> `readonly` **HTTP_VERSION_NOT_SUPPORTED**: `505` = `505`

### IM_A_TEAPOT

> `readonly` **IM_A_TEAPOT**: `418` = `418`

### INSUFFICIENT_STORAGE

> `readonly` **INSUFFICIENT_STORAGE**: `507` = `507`

### INTERNAL_SERVER_ERROR

> `readonly` **INTERNAL_SERVER_ERROR**: `500` = `500`

### LENGTH_REQUIRED

> `readonly` **LENGTH_REQUIRED**: `411` = `411`

### LOCKED

> `readonly` **LOCKED**: `423` = `423`

### LOOP_DETECTED

> `readonly` **LOOP_DETECTED**: `508` = `508`

### METHOD_NOT_ALLOWED

> `readonly` **METHOD_NOT_ALLOWED**: `405` = `405`

### MOVED_PERMANENTLY

> `readonly` **MOVED_PERMANENTLY**: `301` = `301`

### MULTIPLE_CHOICES

> `readonly` **MULTIPLE_CHOICES**: `300` = `300`

### NETWORK_AUTHENTICATION_REQUIRED

> `readonly` **NETWORK_AUTHENTICATION_REQUIRED**: `511` = `511`

### NO_CONTENT

> `readonly` **NO_CONTENT**: `204` = `204`

### NON_AUTHORITATIVE_INFORMATION

> `readonly` **NON_AUTHORITATIVE_INFORMATION**: `203` = `203`

### NOT_ACCEPTABLE

> `readonly` **NOT_ACCEPTABLE**: `406` = `406`

### NOT_EXTENDED

> `readonly` **NOT_EXTENDED**: `510` = `510`

### NOT_FOUND

> `readonly` **NOT_FOUND**: `404` = `404`

### NOT_IMPLEMENTED

> `readonly` **NOT_IMPLEMENTED**: `501` = `501`

### NOT_MODIFIED

> `readonly` **NOT_MODIFIED**: `304` = `304`

### OK

> `readonly` **OK**: `200` = `200`

### PARTIAL_CONTENT

> `readonly` **PARTIAL_CONTENT**: `206` = `206`

### PAYLOAD_TOO_LARGE

> `readonly` **PAYLOAD_TOO_LARGE**: `413` = `413`

### PAYMENT_REQUIRED

> `readonly` **PAYMENT_REQUIRED**: `402` = `402`

### PERMANENT_REDIRECT

> `readonly` **PERMANENT_REDIRECT**: `308` = `308`

### PRECONDITION_FAILED

> `readonly` **PRECONDITION_FAILED**: `412` = `412`

### PRECONDITION_REQUIRED

> `readonly` **PRECONDITION_REQUIRED**: `428` = `428`

### PROCESSING

> `readonly` **PROCESSING**: `102` = `102`

### PROXY_AUTHENTICATION_REQUIRED

> `readonly` **PROXY_AUTHENTICATION_REQUIRED**: `407` = `407`

### RANGE_NOT_SATISFIABLE

> `readonly` **RANGE_NOT_SATISFIABLE**: `416` = `416`

### REQUEST_HEADER_FIELDS_TOO_LARGE

> `readonly` **REQUEST_HEADER_FIELDS_TOO_LARGE**: `431` = `431`

### REQUEST_TIMEOUT

> `readonly` **REQUEST_TIMEOUT**: `408` = `408`

### RESET_CONTENT

> `readonly` **RESET_CONTENT**: `205` = `205`

### SEE_OTHER

> `readonly` **SEE_OTHER**: `303` = `303`

### SERVICE_UNAVAILABLE

> `readonly` **SERVICE_UNAVAILABLE**: `503` = `503`

### SWITCHING_PROTOCOLS

> `readonly` **SWITCHING_PROTOCOLS**: `101` = `101`

### TEMPORARY_REDIRECT

> `readonly` **TEMPORARY_REDIRECT**: `307` = `307`

### TOO_EARLY

> `readonly` **TOO_EARLY**: `425` = `425`

### TOO_MANY_REQUESTS

> `readonly` **TOO_MANY_REQUESTS**: `429` = `429`

### UNAUTHORIZED

> `readonly` **UNAUTHORIZED**: `401` = `401`

### UNAVAILABLE_FOR_LEGAL_REASONS

> `readonly` **UNAVAILABLE_FOR_LEGAL_REASONS**: `451` = `451`

### UNPROCESSABLE_ENTITY

> `readonly` **UNPROCESSABLE_ENTITY**: `422` = `422`

### UNSUPPORTED_MEDIA_TYPE

> `readonly` **UNSUPPORTED_MEDIA_TYPE**: `415` = `415`

### UPGRADE_REQUIRED

> `readonly` **UPGRADE_REQUIRED**: `426` = `426`

### URI_TOO_LONG

> `readonly` **URI_TOO_LONG**: `414` = `414`

### VARIANT_ALSO_NEGOTIATES

> `readonly` **VARIANT_ALSO_NEGOTIATES**: `506` = `506`

## Example

```typescript
import { HttpStatus } from "@croco/problems-core";

if (response.status === HttpStatus.PAYLOAD_TOO_LARGE) {
  // 처리 로직
}
```
