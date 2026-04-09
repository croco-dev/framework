# @croco/audit-core

감사 로그 데코레이터, 인터셉터, 무결성 검증 계약을 제공하는 감사 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/audit-core
```

## 사용법

```ts
import { Auditable } from '@croco/audit-core';

class UserService {
  @Auditable({
    action: 'user.update',
    resourceType: 'User',
    resourceIdParam: 'id',
    payloadParam: 'dto',
  })
  async updateUser(id: string, dto: unknown): Promise<void> {
    void id;
    void dto;
  }
}
```

```ts
import { AuditInterceptor } from '@croco/audit-core';

const interceptor = new AuditInterceptor(auditLogRepository);
```

## API 레퍼런스

### 핵심 클래스와 함수

- `Auditable`, 메서드 실행 결과를 감사 로그로 기록하는 데코레이터입니다.
- `AuditInterceptor`, HTTP 요청 흐름에서 감사 로그를 자동 기록합니다.
- `AuditLogRepository`, 저장소 구현이 따라야 하는 추상 계약입니다.
- `AuditErrorHandler`, 감사 쓰기 실패 시 재시도 정책을 제공합니다.
- `fireAndForgetWithRetry`, 비동기 감사 쓰기를 안전하게 실행합니다.

### 무결성 관련 타입

- `AuditIntegrityVerifier`, `AuditChainVerifier`, `AuditSequenceGenerator`
- `TamperProofAuditLog`, `AuditIntegrityMetadata`, `AuditIntegrityConfig`

### 주요 타입과 상수

- `AuditableOptions`, `AuditLogEntry`, `AuditPayload`, `AuditQuery`
- `AuditExecutionContext`, `Interceptor`, `CallHandler`
- `AUDIT_METADATA_KEY`, `AUDIT_PARAM_KEY`, `AUDIT_LOG_REPOSITORY_TOKEN`

### 문제 타입

- `AuditableDecoratorProblem`

## 구현 포인트

- 실제 영속 저장소는 `AuditLogRepository`를 구현해 drizzle 같은 패키지에 연결합니다.
- impersonation 정보와 요청 메타데이터를 payload와 metadata에 함께 남길 수 있습니다.
- 무결성 검증 계약을 사용하면 tamper-proof audit 체인을 외부 저장소와 결합할 수 있습니다.
