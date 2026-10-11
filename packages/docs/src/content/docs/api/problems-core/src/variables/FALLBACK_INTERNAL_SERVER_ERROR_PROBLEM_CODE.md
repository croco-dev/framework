---
editUrl: false
next: false
prev: false
title: "FALLBACK_INTERNAL_SERVER_ERROR_PROBLEM_CODE"
---

> `const` **FALLBACK_INTERNAL_SERVER_ERROR_PROBLEM_CODE**: `"INTERNAL_SERVER_ERROR"` = `"INTERNAL_SERVER_ERROR"`

transport·filter가 Problem이 아닌 실패를 500 ProblemDetails로 변환할 때 쓰는
공통 fallback code입니다. OpenAPI `ProblemDetails` 계약(`required: code`)과
frontend/rpc client의 Problem 판별(`typeof code === "string"`)을 만족시킵니다.
