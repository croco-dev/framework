# @croco/access-core

Fine-grained Access Control (ACL) 엔진입니다. 리소스 기반 접근 제어 패턴을 제공합니다.

## 개요

`access-core`는 타입 안전한 리소스 접근 제어를 위한 핵심 추상화 레이어입니다. 데코레이터 기반 가드와 공급자 패턴을 통해 유연한 권한 관리를 제공합니다.

## 핵심 개념

### ResourceObject

`resource:id` 형식의 리소스 식별자입니다.

```typescript
type ResourceObject = `${string}:${string}`;

const document = "document:123";
const project = "project:abc";
```

### Subject

접근을 요청하는 주체입니다.

```typescript
type Subject = `user:${string}` | `role:${string}` | `group:${string}`;

const user = "user:123";
const adminRole = "role:admin";
const team = "group:engineering";
```

### Relation

주체와 리소스 간의 관계입니다.

```typescript
type Relation = "owner" | "editor" | "viewer" | "admin" | "member" | string;
```

### RelationTuple

접근 제어의 기본 단위입니다.

```typescript
interface RelationTuple {
  object: ResourceObject;
  relation: Relation;
  subject: Subject;
}
```

## 사용법

### 1. AccessEngine 초기화

```typescript
import { AccessEngine } from "@croco/access-core";
import { DrizzleAccessProvider } from "@croco/access-drizzle";

const provider = new DrizzleAccessProvider(db);
const accessEngine = new AccessEngine(provider);
```

### 2. 데코레이터로 메서드 보호

```typescript
import { Access } from "@croco/access-core";

class DocumentController {
  @Access("document", "editor")
  async updateDocument(documentId: string) {
    // 자동으로 접근 제어 확인
  }
}
```

### 3. 프로그래밍 방식 접근 제어

```typescript
const result = await accessEngine.check({
  tenantId: "tenant-123",
  subject: "user:456",
  relation: "editor",
  object: "document:123",
});

if (result.decision === "allow") {
  // result.allowed is statically true
} else {
  // deny and abstain both carry allowed: false
}

await accessEngine.grant({
  tenantId: "tenant-123",
  tuple: {
    object: "document:123",
    relation: "editor",
    subject: "user:456",
  },
});

await accessEngine.revoke({
  tenantId: "tenant-123",
  tuple: {
    object: "document:123",
    relation: "editor",
    subject: "user:456",
  },
});

const permissions = await accessEngine.list({
  tenantId: "tenant-123",
  subject: "user:456",
});
```

## API

### AccessEngine

#### `check(request: CheckRequest): Promise<CheckResult>`

주체가 리소스에 대한 특정 관계를 가지고 있는지 확인합니다.
`decision`이 권한 판단의 기준이며 `allowed`는 호환성을 위한 리터럴 필드입니다. `allow`는 항상
`allowed: true`, `deny`와 `abstain`은 항상 `allowed: false`를 반환하므로 두 필드가 서로 모순될 수
없습니다. 공급자 구현체도 세 결정 중 하나를 명시적으로 반환해야 합니다.

#### `grant(request: GrantRequest): Promise<void>`

접근 권한을 부여합니다.
런타임 입력의 `object`, `relation`, `subject` 형식을 공급자 호출 전에 다시 검증하며, 잘못된
튜플은 `access-core/invalid-relation-tuple` Problem과 해당 `extensions.field`를 반환합니다.

#### `revoke(request: RevokeRequest): Promise<void>`

접근 권한을 취소합니다.

#### `list(request: ListRequest): Promise<RelationTuple[]>`

조건에 맞는 모든 관계 튜플을 조회합니다.

### @Access(objectType: string, relation: string)

메서드에 접근 제어를 적용하는 데코레이터입니다.

### AccessGuard

CanActivate 가드를 구현하여 데코레이터와 함께 사용합니다.

## 구현체

### @croco/access-drizzle

Drizzle ORM 기반의 AccessProvider 구현체입니다. 재귀적인 관계 조회를 지원합니다.

## 타입 안전성

모든 타입은 TypeScript의 템플릿 리터럴 타입을 활용하여 컴파일 타임에 검증됩니다.

```typescript
const request: CheckRequest = {
  tenantId: "tenant-123",
  subject: "user:456", // ✅ 올바른 형식
  relation: "editor",
  object: "document:123", // ✅ 올바른 형식
};

const invalid: CheckRequest = {
  tenantId: "tenant-123",
  subject: "invalid", // ❌ 컴파일 에러
  relation: "editor",
  object: "document:123",
};
```

## 라이선스

Apache-2.0
