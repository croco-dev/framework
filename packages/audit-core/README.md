# @croco/audit-core

감사 로그 데코레이터, 인터셉터, 무결성 검증 계약을 제공하는 감사 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/audit-core
```

## 사용법

```ts
import { Auditable } from "@croco/audit-core";

class UserService {
  @Auditable({
    action: "user.update",
    resourceType: "User",
    resourceIdIndex: 0,
    payloadIndex: 1,
    includeResult: false,
  })
  async updateUser(id: string, dto: unknown): Promise<void> {
    void id;
    void dto;
  }
}
```

`resourceIdIndex`와 `payloadIndex`는 0부터 시작하는 메서드 파라미터 인덱스입니다. 예를 들어 컨텍스트가 첫 번째
인자이고 리소스 ID와 payload가 뒤따르면 각각 `1`, `2`를 지정합니다. 기존 `resourceIdParam`과 `payloadParam`은
파라미터 이름을 안정적으로 해석할 수 없으므로 제거되었습니다. 첫 번째/두 번째 인자를 선택하던 코드는 위 예제처럼
각각 `resourceIdIndex: 0`, `payloadIndex: 1`로 마이그레이션해야 합니다. 선언되지 않은 인덱스는 데코레이터 적용 시
`AuditableDecoratorProblem`으로 실패하며, 선택된 optional 인자가 생략되면 다른 인자로 대체하지 않습니다.
default 또는 rest 파라미터와 그 뒤의 파라미터는 단일 인덱스로 안전하게 검증할 수 없으므로 선택할 수 없습니다.
다른 메서드 데코레이터와 함께 사용할 때는 `@Auditable`을 메서드에 가장 가까이 배치해야 원본 파라미터 경계를
검증할 수 있습니다.

`Auditable`은 인자, 선택된 payload, diff, 오류 메시지와 명시적으로 포함한 결과에서 일반적인 credential 키와
labelled secret 문자열을 재귀적으로 치환합니다. 메서드 결과는 기본적으로 저장하지 않으며, 필요한 경우에만
`includeResult: true`로 활성화하면 치환된 결과가 기록됩니다.

```ts
import { AuditInterceptor } from "@croco/audit-core";

const interceptor = new AuditInterceptor(auditLogRepository);
```

기본 정책은 `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip` 같은 전달 헤더를 신뢰하지 않고 직접 연결
주소만 기록합니다. 직접 주소를 확인할 수 없는 Fetch 런타임에서는 `unknown`을 기록합니다.

애플리케이션 바로 앞의 프록시가 전달 헤더를 정리하거나 덧붙이는 신뢰 경계라면 hop 수를 명시합니다.

```ts
const interceptor = new AuditInterceptor(auditLogRepository, {
  trustedProxyHops: 2,
});
```

`trustedProxyHops: 2`는 `x-forwarded-for`의 오른쪽에서 두 번째 주소를 클라이언트로 선택합니다. 신뢰 경계가
부족하거나 선택 주소와 신뢰 구간에 빈 값, hostname, port 포함 값, 잘못된 IP가 있으면 전달 헤더 대신 직접
연결 주소를 기록합니다.

## API 레퍼런스

### 핵심 클래스와 함수

- `Auditable`, 메서드 실행 결과를 감사 로그로 기록하는 데코레이터입니다.
- `AuditInterceptor`, 명시적인 trusted-proxy hop 정책으로 HTTP 요청 흐름을 감사 로그에 기록합니다.
- `AuditLogRepository`, 저장소 구현이 따라야 하는 추상 계약입니다.
- `AuditErrorHandler`, 감사 쓰기 실패 시 재시도 정책을 제공합니다.
- `fireAndForgetWithRetry`, 비동기 감사 쓰기를 안전하게 실행합니다.

### 무결성 관련 타입

- `AuditIntegrityVerifier`, `AuditChainVerifier`, `AuditSequenceGenerator`
- `TamperProofAuditLog`, `AuditIntegrityMetadata`, `AuditIntegrityConfig`

### 주요 타입과 상수

- `AuditableOptions`, `AuditLogEntry`, `AuditPayload`, `AuditQuery`
- `AuditInterceptorOptions`
- `AuditExecutionContext`, `Interceptor`, `CallHandler`
- `AUDIT_METADATA_KEY`, `AUDIT_PARAM_KEY`, `AUDIT_LOG_REPOSITORY_TOKEN`

### 문제 타입

- `AuditableDecoratorProblem`
- `AuditClientIpConfigurationProblem`

## 구현 포인트

- 실제 영속 저장소는 `AuditLogRepository`를 구현해 drizzle 같은 패키지에 연결합니다.
- impersonation 정보와 요청 메타데이터를 payload와 metadata에 함께 남길 수 있습니다.
- 무결성 검증 계약을 사용하면 tamper-proof audit 체인을 외부 저장소와 결합할 수 있습니다.
