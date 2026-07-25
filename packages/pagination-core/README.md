# @croco/pagination-core

데이터베이스에 독립적인 커서 및 오프셋 기반 페이지네이션 유틸리티입니다.

## 특징

- **Cursor Pagination**: ULID 기반 커서로 정렬 순서 보장 (실시간 스트리밍, 무한 스크롤)
- **Offset Pagination**: 전체 데이터 수를 포함한 전통적인 페이지네이션
- **Zod 스키마**: 런타임 파라미터 검증 내장
- **타입 안전성**: TypeScript 완전 지원
- **데이터베이스 독립**: PostgreSQL, MySQL, MongoDB 등 모든 DB 사용 가능

## 설치

```bash
pnpm add @croco/pagination-core
```

## 사용법

### Cursor Pagination

실시간 데이터 스트리밍이나 무한 스크롤에 적합합니다.

```typescript
import { createCursorPage, encodeCursor, decodeCursor } from "@croco/pagination-core";

interface User {
  id: string;
  name: string;
}

const users: User[] = [
  { id: "usr_01HXY...", name: "Alice" },
  { id: "usr_01HXZ...", name: "Bob" },
  { id: "usr_01HY0...", name: "Charlie" },
];

const page = createCursorPage(users, {
  limit: 2,
  getId: (user) => user.id,
});

console.log(page);
// {
//   data: [{ id: 'usr_01HXY...', name: 'Alice' }],
//   hasMore: true,
//   nextCursor: 'eyJ2IjoxLCJpZCI6InVzcl8wMVhIWS4uLiJ9'
// }
```

양방향 페이지네이션 (이전/다음):

```typescript
const fullPage = createCursorPage(users, {
  limit: 2,
  getId: (user) => user.id,
  hasPrevious: true,
  prevCursor: "eyJ2IjoxLCJpZCI6InVzcl8wMVhYLi4uIn0=",
});

console.log(fullPage);
// {
//   data: [...],
//   hasMore: true,
//   nextCursor: '...',
//   hasPrevious: true,
//   prevCursor: 'eyJ2IjoxLCJpZCI6InVzcl8wMVhYLi4uIn0='
// }
```

커서 인코딩/디코딩:

```typescript
const cursor = encodeCursor({ v: 1, id: "usr_01HXY..." });
console.log(cursor); // 'eyJ2IjoxLCJpZCI6InVzcl8wMVhYWS4uLiJ9'

const payload = decodeCursor(cursor);
console.log(payload); // { v: 1, id: 'usr_01HXY...' }
```

### Offset Pagination

전체 데이터 수를 보여줘야 하는 관리자 페이지나 검색 결과에 적합합니다.

```typescript
import { createOffsetPage } from '@croco/pagination-core';

const products: Product[] = [...];

const page = createOffsetPage(products, {
  total: 150,
  limit: 20,
  offset: 0,
});

console.log(page);
// {
//   data: [...],
//   total: 150,
//   limit: 20,
//   offset: 0
// }
```

### 파라미터 파싱

쿼리 스트링을 페이지네이션 파라미터로 변환합니다.

```typescript
import { parsePaginationParams } from "@croco/pagination-core";

const query = {
  cursor: "eyJ2IjoxLCJpZCI6InVzcl8wMVhYWS4uLiJ9",
  limit: "20",
};

const params = parsePaginationParams(query);

if (params.mode === "cursor") {
  console.log(params.cursor); // 'eyJ2IjoxLCJpZCI6InVzcl8wMVhYWS4uLiJ9'
  console.log(params.limit); // 20
}
```

오프셋 모드:

```typescript
const query = {
  offset: "40",
  limit: "20",
};

const params = parsePaginationParams(query);

if (params.mode === "offset") {
  console.log(params.offset); // 40
  console.log(params.limit); // 20
}
```

### Zod 스키마 검증

```typescript
import { PaginationParamsSchema, CursorParamsSchema } from "@croco/pagination-core";

const query = {
  mode: "cursor",
  cursor: "eyJ2IjoxLCJpZCI6InVzcl8wMVhYWS4uLiJ9",
  limit: "25",
};

const result = PaginationParamsSchema.safeParse(query);

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

### REST API 예시 (Hono)

```typescript
import { Hono } from "hono";
import { parsePaginationParams, createCursorPage } from "@croco/pagination-core";
import { ConflictingPaginationProblem } from "@croco/pagination-core";

const app = new Hono();

app.get("/users", async (c) => {
  const query = c.req.query();
  const params = parsePaginationParams(query);

  const users = await db.users.findMany({
    take: params.limit + 1,
    cursor:
      params.mode === "cursor" && params.cursor
        ? { id: decodeCursor(params.cursor).id }
        : undefined,
  });

  const page = createCursorPage(users, {
    limit: params.limit,
    getId: (user) => user.id,
  });

  return c.json(page);
});
```

## API

### `createCursorPage<T>(items, options)`

커서 기반 페이지를 생성합니다.

**옵션:**

- `limit: number` - 페이지당 항목 수
- `getId: (item: T) => string` - 항목에서 ID 추출 함수
- `hasPrevious?: boolean` - 이전 페이지 존재 여부
- `prevCursor?: string | null` - 이전 커서

**반환값:**

```typescript
{
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
}
```

양방향 모드 사용 시:

```typescript
{
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
  hasPrevious: boolean;
  prevCursor: string | null;
}
```

### `createOffsetPage<T>(items, options)`

오프셋 기반 페이지를 생성합니다.

**옵션:**

- `total: number` - 전체 항목 수
- `limit: number` - 페이지당 항목 수
- `offset: number` - 건너뛸 항목 수

**반환값:**

```typescript
{
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
```

### `encodeCursor(payload)`

커서 페이로드를 Base64로 인코딩합니다.

```typescript
encodeCursor({ v: 1, id: "usr_01HXY..." });
// 'eyJ2IjoxLCJpZCI6InVzcl8wMVhYWS4uLiJ9'
```

### `decodeCursor(cursor)`

Base64 커서를 디코딩합니다. 유효하지 않은 커서면 `InvalidCursorProblem`을 던집니다.

```typescript
decodeCursor("eyJ2IjoxLCJpZCI6InVzcl8wMVhYWS4uLiJ9");
// { v: 1, id: 'usr_01HXY...' }
```

### `parsePaginationParams(query)`

쿼리 스트링을 페이지네이션 파라미터로 파싱합니다.

**기본값:**

- `limit`: 20 (최소 1, 최대 100)
- `offset`: 0
- `cursor`: undefined
- `direction`: undefined (`forward` 또는 `backward`, cursor 모드에서만 사용)
- `mode`: 자동 감지 (`cursor` 또는 `offset` 둘 중 하나만 사용)

**숫자 정규화 정책:**

- 숫자 문자열은 문자열 전체가 유한한 숫자일 때만 허용합니다. 앞뒤 공백과 `+`/`-` 부호는 허용합니다.
- 소수는 내림합니다.
- `limit`가 1보다 작거나 값이 비어 있거나 유효하지 않으면 20을 사용하고, 100보다 크면 100으로 제한합니다.
- `offset`이 음수이거나 값이 비어 있거나 유효하지 않거나 안전한 정수 범위를 벗어나면 0을 사용합니다.
- 숫자 query 값이 배열이면 값이 하나일 때만 숫자로 처리하고, 반복된 값은 유효하지 않은 값으로 처리합니다.
- `parsePaginationParams`, `CursorParamsSchema`, `OffsetParamsSchema`, `PaginationParamsSchema`는 같은 정책으로
  숫자 필드를 정규화합니다. 숫자 형식 오류는 별도로 거부하지 않습니다.

**에러:**

- `cursor`와 `offset`을 동시에 사용하면 `ConflictingPaginationProblem`
- `direction` 값이 유효하지 않거나 offset 모드에서 사용되면 `InvalidPaginationDirectionProblem`

## Zod 스키마

모든 페이지네이션 파라미터 타입에 대한 Zod 스키마를 제공합니다.

```typescript
import {
  CursorParamsSchema,
  OffsetParamsSchema,
  PaginationParamsSchema,
  CursorPayloadSchema,
} from "@croco/pagination-core";
```

## 타입

```typescript
type CursorParams = {
  cursor?: string;
  limit: number;
  direction?: "forward" | "backward";
};

type OffsetParams = {
  offset: number;
  limit: number;
};

type PaginationParams = ({ mode: "cursor" } & CursorParams) | ({ mode: "offset" } & OffsetParams);

type CursorPage<T> = {
  data: T[];
  hasMore: boolean;
  nextCursor: string | null;
};

type OffsetPage<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};
```

## Best Practices

1. **Cursor vs Offset**: 실시간 데이터에는 Cursor, 정적 데이터에는 Offset
2. **Limit 제한**: 최대 100으로 제한 (성능 보호)
3. **커서 버전**: 커서 포맷 변경 시 `CURSOR_VERSION`을 증가
4. **에러 처리**: `InvalidCursorProblem`, `ConflictingPaginationProblem` 적절히 처리

## 라이선스

MIT
