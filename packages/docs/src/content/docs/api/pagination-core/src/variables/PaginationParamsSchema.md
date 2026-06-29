---
editUrl: false
next: false
prev: false
title: "PaginationParamsSchema"
---

> `const` **PaginationParamsSchema**: `ZodDiscriminatedUnion`\<\[`ZodObject`\<\{ `cursor`: `ZodOptional`\<`ZodString`\>; `direction`: `ZodOptional`\<`ZodEnum`\<\{ `backward`: `"backward"`; `forward`: `"forward"`; \}\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `mode`: `ZodLiteral`\<`"cursor"`\>; \}, `$strip`\>, `ZodObject`\<\{ `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `mode`: `ZodLiteral`\<`"offset"`\>; `offset`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; \}, `$strip`\>\], `"mode"`\>
