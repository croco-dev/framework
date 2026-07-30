# @croco/auth-core

RBAC, API 키, 인증 가드, 권한 데코레이터를 제공하는 인증 코어 패키지입니다.

## 설치

```bash
pnpm add @croco/auth-core
```

## 사용법

```ts
import {
  AesGcmApiKeyRotationProtector,
  ApiKeyGenerator,
  ApiKeyHasher,
  ApiKeyManager,
} from "@croco/auth-core";

const rotationProtector = new AesGcmApiKeyRotationProtector({
  activeKeyId: "2026-07",
  keys: {
    "2026-07": rotationProtectionKey,
  },
});

const manager = new ApiKeyManager(
  apiKeyStore,
  new ApiKeyGenerator(),
  new ApiKeyHasher(),
  eventBus,
  logger,
  rotationProtector,
);

const created = await manager.create({
  tenantId: "tenant-123",
  name: "server-to-server",
  permissions: ["project:read", "project:write"],
});

const principal = await manager.verify(created.key);

const rotated = await manager.rotate(created.id, {
  idempotencyKey: "deploy-2026-07-30",
});
```

`rotate()`는 호출자가 제공한 멱등성 키로 하나의 논리적 회전을 식별합니다. 저장소는 기존 키 폐기와 대체 키 저장을
원자적으로 처리해야 하며, 성공 응답이나 이벤트 발행이 유실되면 같은 멱등성 키로 재시도해 동일한 대체 키를 복구합니다.
복구 자료는 AES-256-GCM으로 보호되며, 회전 레코드가 재생 가능한 동안 해당 레코드를 암호화한 이전 보호 키도 설정에
유지해야 합니다.

```ts
import { RequirePermission, RbacEngine, RoleRegistry } from "@croco/auth-core";

const roleRegistry = new RoleRegistry({
  admin: ["project:read", "project:write"],
});

const rbac = new RbacEngine(roleRegistry);

class ProjectController {
  @RequirePermission("project:write")
  async update(): Promise<void> {}
}
```

## API 레퍼런스

### 핵심 클래스

- `ApiKeyManager`, API 키 생성, 검증, 폐기, 회전을 담당합니다.
- `ApiKeyGenerator`, 안전한 API 키를 생성하고 파싱합니다.
- `ApiKeyHasher`, API 키 해시와 검증을 담당합니다.
- `AesGcmApiKeyRotationProtector`, 재시도 가능한 회전 복구 자료를 보호합니다.
- `RbacEngine`, 사용자와 역할 기반 권한 검사를 수행합니다.
- `RoleRegistry`, 역할과 권한 집합을 관리합니다.
- `AuthGuard`, `ApiKeyGuard`, `PermissionGuard`, `UnifiedAuthGuard`, 라우트 보호를 담당합니다.

### 데코레이터

- `@Public`, 공개 엔드포인트를 표시합니다.
- `@RequireApiKey`, API 키 인증이 필요한 엔드포인트를 표시합니다.
- `@RequirePermission`, 필요한 권한을 선언합니다.
- `@CurrentPrincipal`, `@CurrentApiKey`, `@User`, 현재 인증 주체를 주입합니다.

### 주요 타입

- `AuthUser`, `Principal`, `ApiKeyPrincipal`, `UserPrincipal`
- `AuthProvider`, `ApiKeyProvider`, `SessionProvider`, `TenantMappingProvider`
- `AuthRequest`, `ApiKey`, `CreateApiKeyOptions`, `CreateApiKeyResult`, `RotateApiKeyOptions`

### 문제 타입

- `UnauthorizedProblem`, `ForbiddenProblem`
- `AuthProviderUnavailableProblem`, `InvalidRouteMetadataTargetProblem`
- `ApiKeyExpiredProblem`, `ApiKeyRevokedProblem`, `ApiKeyNotFoundProblem`
- `ApiKeyRotationConflictProblem`, `ApiKeyRotationProtectionProblem`
- `InvalidPermissionFormatProblem`, `InvalidPermissionActionProblem`

## AuthGuard conformance

`AuthGuard`와 `UnifiedAuthGuard`는 protected route에서 `AuthProvider` 또는 `ApiKeyProvider`를 호출하고,
성공한 `AuthUser` 또는 `ApiKeyPrincipal`을 `request.user`, `request.principal`, `request.apiKey`에 주입합니다.
`AuthUser.roles`, `AuthUser.permissions`, `AuthUser.tenantId`, `metadata`는 provider가 반환한 값을 그대로 보존합니다.
auth-core는 scope를 별도 최상위 필드로 해석하지 않으며, scope 값은 보통 `permissions` 또는 `metadata.scopes`에 둡니다.

공개 route는 `@Public`/`AUTH_PUBLIC_KEY` 메타데이터로 표시하며 provider를 호출하지 않습니다. provider 미등록 또는
provider가 `null`을 반환하는 경우 `UnauthorizedProblem`으로 실패하고, provider가 일반 예외를 던지는 경우
`AuthProviderUnavailableProblem`으로 실패합니다. provider가 이미 Croco `Problem`을 던진 경우에는 해당 Problem을 보존합니다.
가드 실행 컨텍스트가 유효한 controller metadata target을 제공하지 않으면 공개 route로 추정하지 않고
`InvalidRouteMetadataTargetProblem`으로 실패합니다.

## 구현 포인트

- 세션 기반 인증은 `SessionProvider`와 `AuthProvider` 구현체로 연결합니다.
- API 키 흐름은 이벤트로 감사 로그, 메트릭, 알림 패키지와 쉽게 결합할 수 있습니다.
- 권한 문자열은 `resource:action` 또는 `resource:action:resourceId` 형식을 따르며 `parsePermission`,
  `formatPermission` 유틸리티를 제공합니다. `resourceId`를 포함할 때는 비어 있지 않아야 합니다.
- 전역 권한은 같은 resource/action의 객체별 요구를 충족하지만, 객체별 권한은 동일한 `resourceId`에만 적용되며
  전역 요구를 충족하지 않습니다. `manage` 권한에도 같은 scope 규칙이 적용됩니다.
