# @croco/gid-core

ULID 기반 타입 안전 Prefix ID 생성 및 검증 라이브러리입니다.

## 특징

- **ULID 기반**: 시간순 정렬 가능하고 충돌 확률이 낮은 ULID 사용
- **타입 안전성**: Branded Type으로 컴파일 타임에 ID 타입 검증
- **Prefix 기반**: 도메인별로 고유한 prefix로 ID 구분 (usr*, ord*, wks\_ 등)
- **런타임 검증**: 유효하지 않은 ID 형식을 런타임에 안전하게 거부

## 설치

```bash
pnpm add @croco/gid-core
```

## 사용법

### 단일 ID 생성

```typescript
import { IdPrefix } from "@croco/gid-core";

const UserId = new IdPrefix("usr");

type UserId = PrefixedId<"usr">;

const userId: UserId = UserId.generate();
// 예: usr_01HXY5XM9Z8Y7W6V5U4T3S2R1

const isValid: boolean = UserId.validate(userId);
if (isValid) {
  console.log("유효한 사용자 ID입니다");
}
```

### 여러 ID 타입 관리

```typescript
import { defineIdPrefixes } from "@croco/gid-core";

const Ids = defineIdPrefixes({
  USER: "usr",
  ORDER: "ord",
  WORKSPACE: "wks",
} as const);

type UserId = PrefixedId<"usr">;
type OrderId = PrefixedId<"ord">;
type WorkspaceId = PrefixedId<"wks">;

const userId: UserId = Ids.USER.generate();
const orderId: OrderId = Ids.ORDER.generate();
const workspaceId: WorkspaceId = Ids.WORKSPACE.generate();

// 타입 안전성 - 서로 다른 ID 타입을 혼용하면 컴파일 에러
function getUserById(id: UserId) {
  return Ids.USER.validate(id);
}

getUserById(userId); // ✅ OK
getUserById(orderId); // ❌ Compile Error
```

### 타입 가드 활용

```typescript
import { IdPrefix } from "@croco/gid-core";

const ProductId = new IdPrefix("prd");

function processProductId(id: unknown) {
  if (ProductId.validate(id)) {
    // id는 타입 가드에 의해 PrefixedId<'prd'> 타입으로 좁혀짐
    console.log(`Product ID: ${id}`);
  } else {
    throw new Error("Invalid product ID");
  }
}
```

## API

### `IdPrefix<TPrefix>`

단일 prefix를 위한 ID 생성 및 검증 클래스입니다.

#### 생성자

```typescript
constructor(prefix: TPrefix)
```

- `prefix`: 3자 이상의 문자열 (짧을수록 더 효율적)
- `InvalidIdPrefixProblem`을 던짐 (3자 미만인 경우)

#### 메서드

- `generate(): PrefixedId<TPrefix>` - 새 ID 생성
- `validate(id: unknown): id is PrefixedId<TPrefix>` - ID 검증 (타입 가드)
- `getPrefix(): TPrefix` - prefix 반환
- `getExpectedLength(): number` - 전체 ID 길이 반환

#### 정적 메서드

- `IdPrefix.getLength(prefixLength?: number): number` - 예상 ID 길이 계산

### `defineIdPrefixes<T>`

여러 ID prefix를 한 번에 정의합니다.

```typescript
function defineIdPrefixes<const T extends Record<string, string>>(config: T): IdPrefixRegistry<T>;
```

- 중복된 prefix 값이 있으면 컴파일 에러 발생
- 각 key에 대해 `IdPrefixInstance`를 반환

### `PrefixedId<TPrefix>`

Branded Type으로, template literal type과 unique symbol brand를 결합합니다.

```typescript
export type PrefixedId<TPrefix extends string> = `${TPrefix}_${string}` & {
  readonly __brand: unique symbol;
};
```

이 타입은:

- 컴파일 타임에 형식 검증 (`usr_xxx` 형태 강제)
- 다른 prefix와의 혼용 방지
- 런타임 오버헤드 없음 (타입 정보만 제공)

## ID 형식

```
{prefix}_{ulid}
```

- `prefix`: 3자 이상의 사용자 정의 문자열
- `ulid`: 26자 ULID (시간순 정렬 가능, URL-safe)
- 전체 길이: `prefix.length + 1 + 26`

예시:

- `usr_01HXY5XM9Z8Y7W6V5U4T3S2R1` (30자, prefix=usr)
- `wks_01HXY5XM9Z8Y7W6V5U4T3S2R1` (30자, prefix=wks)

## 검증 규칙

ID는 다음 조건을 모두 만족해야 유효합니다:

1. 문자열 타입
2. 정확한 길이 (prefix + 1 + 26)
3. 올바른 prefix로 시작
4. 유효한 ULID 형식 (Crockford's Base32)

## 에러 처리

```typescript
import { IdPrefix } from "@croco/gid-core";
import { InvalidIdPrefixProblem } from "@croco/gid-core";

try {
  const TooShort = new IdPrefix("ab");
} catch (error) {
  if (error instanceof InvalidIdPrefixProblem) {
    console.error(error.detail);
    // "Prefix must be at least 3 characters long, but got 2"
  }
}
```

## 타입 안전성 예시

```typescript
import { defineIdPrefixes } from "@croco/gid-core";

const Ids = defineIdPrefixes({
  USER: "usr",
  ORDER: "ord",
} as const);

type UserId = PrefixedId<"usr">;
type OrderId = PrefixedId<"ord">;

// 함수 시그니처에 특정 ID 타입 명시
function getUser(id: UserId) {
  /* ... */
}
function getOrder(id: OrderId) {
  /* ... */
}

const userId = Ids.USER.generate();
const orderId = Ids.ORDER.generate();

getUser(userId); // ✅ OK
getUser(orderId); // ❌ Compile Error: 타입 불일치

// assignability 체크
let id: PrefixedId<"usr"> = userId; // ✅ OK
id = orderId; // ❌ Compile Error
```

## Best Practices

1. **Prefix 짧게 유지**: 3-5자 권장 (URL 길이 절약)
2. **도메인별 고유 prefix**: `usr`, `ord`, `wks`, `prd` 등
3. **const assertion 사용**: `defineIdPrefixes`에서 `as const` 필수
4. **타입 명시**: `PrefixedId<T>` 타입을 명시적으로 사용하여 타입 안전성 극대화

## 라이선스

MIT
