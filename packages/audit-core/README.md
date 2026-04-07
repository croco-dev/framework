# @croco/audit-core

Croco Framework의 감사 로깅 핵심 패키지입니다. 사용자 활동과 상태 변경을 추적하는 감사 로그 기능을 제공합니다.

## 설치

```bash
npm install @croco/audit-core
```

## 주요 기능

### @Auditable 데코레이터

메서드 실행을 자동으로 감사 로그에 기록합니다.

```typescript
import { Auditable } from '@croco/audit-core';

class UserService {
  @Auditable({
    action: 'user.update',
    resourceType: 'User',
    resourceIdParam: 'id',
    payloadParam: 'dto',
  })
  async updateUser(id: string, dto: UpdateUserDto) {
    // 사용자 업데이트 로직
  }
}
```

### AuditInterceptor

HTTP 요청에 대한 감사 로그를 자동으로 기록합니다.

```typescript
import { AuditInterceptor } from '@croco/audit-core';

const interceptor = new AuditInterceptor(auditLogRepository);
```

### 변조 방지 (Tamper-Proof)

감사 로그 무결성을 검증하기 위한 인터페이스를 제공합니다.

```typescript
import type { AuditIntegrityVerifier, AuditChainVerifier } from '@croco/audit-core';

// 구현체는 audit-drizzle 등에서 제공
class MyIntegrityVerifier implements AuditIntegrityVerifier {
  verify(entry: AuditLogEntry): boolean {
    // 무결성 검증 로직
  }

  computeHash(entry: Omit<AuditLogEntry, 'integrityHash'>): string {
    // 해시 계산 로직
  }
}
```

### 에러 핸들링

fire-and-forget 패턴에 재시도 로직을 포함한 에러 핸들링을 제공합니다.

```typescript
import { AuditErrorHandler, fireAndForgetWithRetry } from '@croco/audit-core';

const handler = new AuditErrorHandler({
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
});

const { promise, abort } = fireAndForgetWithRetry(
  () => repository.create(entry),
  { maxRetries: 3 }
);
```

## 타입 안전성

모든 타입은 strict TypeScript 모드에서 안전하게 동작합니다.

- `as any` 사용 없이 타입 추론이 완벽하게 동작
- 파라미터 파싱은 런타임에 안전하게 처리
- 모든 외부 입력에 대한 타입 가드 제공

## API 문서

자세한 API 문서는 [Croco Framework Docs](https://croco.dev/docs)에서 확인하세요.
