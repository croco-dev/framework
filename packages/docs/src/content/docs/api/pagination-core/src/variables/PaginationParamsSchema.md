---
editUrl: false
next: false
prev: false
title: "PaginationParamsSchema"
---

> `const` **PaginationParamsSchema**: `ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `cursor`: `ZodOptional`\<`ZodString`\>; `direction`: `ZodOptional`\<`ZodEnum`\<\{ `backward`: `"backward"`; `forward`: `"forward"`; \}\>\>; `limit`: `ZodDefault`\<`ZodCatch`\<`ZodCoercedNumber`\<`unknown`\>\>\>; `mode`: `ZodLiteral`\<`"cursor"`\>; \}, `$strip`\>, `ZodObject`\<\{ `direction`: `ZodOptional`\<`ZodNever`\>; `limit`: `ZodDefault`\<`ZodCatch`\<`ZodCoercedNumber`\<`unknown`\>\>\>; `mode`: `ZodLiteral`\<`"offset"`\>; `offset`: `ZodDefault`\<`ZodCatch`\<`ZodCoercedNumber`\<`unknown`\>\>\>; \}, `$strip`\>\], `"mode"`\>
