# @croco/auth-better-auth

Better Auth와 Drizzle을 Croco 인증 흐름에 연결하는 패키지입니다.

## 설치

```bash
pnpm add @croco/auth-better-auth @croco/framework-module better-auth drizzle-orm
```

## 사용법

### Application plugin

```typescript
import { betterAuth } from "@croco/auth-better-auth";
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";

const runtime = createApplicationRuntime(
  defineCrocoApplication({
    imports: [
      betterAuth({
        db,
        baseURL: process.env.BETTER_AUTH_URL!,
        secret: process.env.BETTER_AUTH_SECRET!,
        webhookSecret: process.env.BETTER_AUTH_WEBHOOK_SECRET,
      }),
    ],
  }),
);

await runtime.initialize();
```

`betterAuth()`는 인증 provider와 readiness diagnostics를 같은 inspectable application graph에
등록합니다. Plugin 생성과 runtime 초기화는 전역 `Container`에 `AUTH_PROVIDER_TOKEN`을 등록하지 않습니다.

### 1. Drizzle과 팩토리 등록

```typescript
import { BetterAuthFactory, DRIZZLE_TOKEN } from "@croco/auth-better-auth";
import { Container } from "@croco/framework-context";

Container.register(DRIZZLE_TOKEN, db);

const factory = new BetterAuthFactory(db, {
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
});
```

### 2. 인증 사용자 변환

```typescript
import { BetterAuthProvider } from "@croco/auth-better-auth";

const provider = new BetterAuthProvider(factory);
const user = await provider.authenticate(request);
```

#### 권한 claim 신뢰 설정과 마이그레이션

기본 설정은 Better Auth admin plugin이 관리하는 최상위 `user.role`만 권한 claim으로 신뢰합니다.
신뢰한 단수 `role` 문자열은 쉼표로 나누고 앞뒤 공백과 빈 값을 제거합니다. 예를 들어
`role: "admin, support"`는 `AuthUser.roles`의 `["admin", "support"]`로 변환됩니다.
`roles`와 합칠 때 중복 역할은 제거하며, `roles` 배열과 `permissions`·`permission` claim의 문자열은
쉼표로 나누지 않습니다.
그 밖의 최상위 claim은 `trustedUserFields`에 명시해야 합니다. `trustedMetadataKeys`의 기본값은
`[]`이며, `metadata`, `userMetadata`, `publicMetadata`, `privateMetadata`, `rbac` 등 중첩 객체의
claim은 기본적으로 권한·테넌트 매핑에서 제외됩니다.

서버만 쓰기를 허용한 필드와 객체에 한해 다음처럼 신뢰 범위를 지정합니다.

```typescript
import { BetterAuthProvider } from "@croco/auth-better-auth";

const provider = new BetterAuthProvider(factory, {
  trustedUserFields: ["permissions", "tenantId"],
  trustedMetadataKeys: ["privateMetadata"],
});
```

Application plugin에서는 같은 옵션을 `provider`에 전달합니다.

```typescript
import { betterAuth } from "@croco/auth-better-auth";

const plugin = betterAuth({
  db,
  baseURL: process.env.BETTER_AUTH_URL!,
  secret: process.env.BETTER_AUTH_SECRET!,
  provider: {
    trustedUserFields: ["permissions", "tenantId"],
    trustedMetadataKeys: ["privateMetadata"],
  },
});
```

Better Auth에서 `privateMetadata`라는 이름 자체가 서버 전용 쓰기를 보장하지는 않습니다.
신뢰 대상으로 추가하기 전에 upstream Better Auth의 `user.additionalFields`에서 해당 필드에
[`input: false`](https://better-auth.com/docs/concepts/database)를 설정하고, 직접 구현한 쓰기 경로도
서버 권한 검사로 보호해야 합니다.
이 신뢰 옵션은 이미 세션에 포함된 claim의 매핑만 제어하며, upstream 추가 필드나 데이터베이스
스키마를 생성·설정하지 않습니다. 현재 `BetterAuthFactory`의 설정은 `baseURL`, `secret`만 받습니다.

각 claim 키는 신뢰한 최상위 필드부터 확인하고, 이어서 `trustedMetadataKeys`에 지정한 순서대로
중첩 객체를 확인합니다. 처음 발견한 `undefined`가 아닌 값을 사용하므로 빈 배열이나 잘못된 타입도
같은 키의 뒤쪽 값을 가립니다. `roles`와 `role`, `permissions`와 `permission`은 각각 문자열 또는
배열의 문자열 원소를 중복 없이 합칩니다. 테넌트는 `tenantId`, `tenant_id` 순서로, 조직은
`orgId`, `org_id`, `organizationId`, `organization_id` 순서로 각 키의 선택된 값 중 첫 문자열을
사용합니다. 이 별칭들은 `trustedUserFields`에서도 개별 키로 지정합니다.
선택한 테넌트 ID는 `AuthUser.tenantId`에 반영하며, 테넌트 ID가 없으면 선택한 조직 ID를 사용합니다.
기존 `metadata.tenantId`와 `metadata.orgId`는 각 클레임의 추출값을 그대로 유지합니다.

신뢰하지 않은 위치에서 알려진 claim을 발견하면 `auth-better-auth/untrusted-claims` 코드로
경고합니다. 기본 출력은 `console.warn`이며 생성자 옵션의 `logger` 또는 plugin의 `provider.logger`에
`Pick<ILogger, "warn">` 구현을 전달할 수 있습니다. 경고에는 고정 메시지·코드와 알려진 claim 이름만
포함하며 claim 값, 사용자 정보, 세션은 기록하지 않습니다.

기존의 암묵적 metadata 매핑에 의존했다면 쓰기 권한을 먼저 점검한 뒤 필요한 필드·객체만 신뢰 목록에
추가하세요. 최상위 admin plugin `role` 매핑은 유지됩니다. 사용자 입력이 가능한 metadata를 그대로
신뢰 목록에 추가하면 권한 상승이나 다른 테넌트 접근을 허용할 수 있습니다.

### 3. 세션 관리

```typescript
import { BetterAuthSessionManager } from "@croco/auth-better-auth";

const sessions = new BetterAuthSessionManager(factory);
const session = await sessions.getSession(token);
await sessions.revokeSession(targetSessionToken, sessionToken);
await sessions.revokeUserSessions("user_123", adminSessionToken);
```

`BetterAuthFactory`는 Bearer 인증과 관리자 세션 해제 API에 필요한 Better Auth `bearer`, `admin`
plugin을 기본으로 등록합니다. `revokeSession()`은 해제할 세션 토큰과 현재 사용자 세션 토큰을 분리해
받으므로 다른 활성 세션도 해제할 수 있습니다. `revokeUserSessions()`는 `session:revoke` 권한이 있는
관리자 세션 토큰을 두 번째 인자로 받습니다. 기존 데이터베이스에는 admin plugin이 사용하는 사용자
역할·차단 필드와 세션 impersonation 필드를 마이그레이션해야 합니다.

### 4. 웹훅 처리

```typescript
import { BetterAuthWebhookProcessor } from "@croco/auth-better-auth";

const processor = new BetterAuthWebhookProcessor(
  {
    signingSecret: process.env.BETTER_AUTH_WEBHOOK_SECRET!,
    idempotencyStore,
  },
  {
    "session.revoked": async (payload) => {
      await auditSession(payload);
    },
  },
  sessions,
);

await processor.processWebhook(request);
```

웹훅 본문의 ISO 8601 `timestamp`는 이벤트 발생 시각입니다. 재전송을 지원하는 발신자는
본문과 이벤트 `id`를 그대로 유지하고, 매 전달마다 현재 시각을 `x-better-auth-timestamp`에
넣어 다음 형식으로 서명해야 합니다. 이 패키지는 수신 처리기를 제공하며 발신 요청은
애플리케이션에서 구성합니다.

```typescript typecheck
import { createHmac } from "node:crypto";

function createDeliveryHeaders(rawBody: string, signingSecret: string): Record<string, string> {
  const deliveryTimestamp = new Date().toISOString();
  const signature = createHmac("sha256", signingSecret)
    .update(`${deliveryTimestamp}.${rawBody}`)
    .digest("hex");

  return {
    "content-type": "application/json",
    "x-better-auth-timestamp": deliveryTimestamp,
    "x-better-auth-signature": `v1=${signature}`,
  };
}
```

발신자는 HTTP 요청 실패 또는 non-2xx 응답을 성공으로 처리하지 않아야 합니다. 재시도할 때는
최초 요청과 바이트 단위로 동일한 `rawBody`와 이벤트 `id`를 유지하고, 위 함수를 다시 호출해
새 전달 시각과 서명을 생성해야 합니다.

`v1` 서명은 전달 시각과 본문 원문을 함께 보호합니다. 처리기는 전달 시각이 수신 시각에서
과거·미래 어느 방향으로든 5분을 넘으면 거부합니다. 전달 시각과 본문의 발생 시각 모두
시간대가 명시된 유효한 ISO 8601 문자열이어야 합니다. 본문의 발생 시각은 재전송 때 갱신하지 않습니다.

기존 `sha256=<HMAC-SHA256(secret, rawBody)>` 서명은 `x-better-auth-timestamp` 없이 사용할 수
있습니다. 이 형식은 본문의 `timestamp`로 5분 유효기간을 확인하므로 오래된 이벤트를 그대로
재전송할 수 없습니다. `sha256` 서명과 전달 시각 헤더를 섞거나 `v1` 서명에서 전달 시각 헤더를
생략하면 요청을 거부합니다.

처리기는 검증된 `id`와 본문 fingerprint로 중복 전달을 구분합니다. 중단된 처리의 lease는
기본 15분 뒤 만료되며, 같은 본문을 새 전달 시각으로 서명한 요청이 처리를 다시 시도할 수 있습니다.
핸들러가 오래 실행될 수 있으면 `processingLeaseMs`를 예상 최대 실행 시간보다 길게 설정하세요.
예를 들어 `processingLeaseMs: 30 * 60_000`은 30분 lease를 사용합니다.
완료 결과는 24시간 보존합니다. 동일 `id`로 본문을 바꾸면 충돌로 거부합니다.
같은 processor에 동시에 들어온 동일한 유효 전달은 활성 실행 결과를 함께 기다립니다.
다른 인스턴스에서 처리 중인 전달은 충돌로 보고합니다. `id`가 없으면 서명된 본문 원문의
SHA-256 digest가 전달 ID가 됩니다. 여러 프로세스나 인스턴스에서 실행할 때는 공유 durable
`idempotencyStore`를 제공해야 합니다.
Custom 저장소는 `leaseMs`를 결과 보존 기간과 독립적으로 처리하고 conformance suite를 통과한 뒤
`processingLeaseVersion: 1`을 선언해야 합니다. 선언하지 않은 저장소는 processor 구성 시 거부됩니다.

### 5. 제공 스키마 사용

```typescript
import { account, session, user, verification } from "@croco/auth-better-auth";

export const authSchema = { user, session, account, verification };
```

## Diagnostics와 Conformance

`BetterAuthDiagnosticsProvider`는 `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, 앱이 제공하는
Drizzle 연결, 선택적 `BETTER_AUTH_WEBHOOK_SECRET` 준비 상태를 secret 값 없이 보고합니다.

```typescript
import { BetterAuthDiagnosticsProvider } from "@croco/auth-better-auth";

const diagnostics = new BetterAuthDiagnosticsProvider({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  webhookSecret: process.env.BETTER_AUTH_WEBHOOK_SECRET,
  databaseConfigured: true,
});
```

패키지 테스트는 `@croco/testing`의 `createAuthProviderConformanceSuite()`를 사용해 아래
계약을 기본 no-credential CI에서 검증합니다.

- 유효한 세션을 `AuthUser`로 변환하고 신뢰하도록 설정한 출처의 `roles`, `permissions`, `orgId`,
  `tenantId`를 매핑합니다.
- 누락/무효 세션은 인증되지 않은 상태(`null`)로 처리하고, malformed session payload는
  `auth-better-auth/invalid-session-payload` Problem으로 실패합니다.
- Better Auth upstream 실패는 secret 값을 redaction한
  `auth-better-auth/authentication-failed` Problem으로 정규화합니다.
- 웹훅은 HMAC 서명 성공/실패와 malformed payload를 stable Problem code로 검증합니다.
- readiness diagnostics는 필수 env 이름만 노출하고 secret 값은 노출하지 않습니다.

Optional live smoke는 기본적으로 skip됩니다. 실제 Better Auth 배포를 검증하려면 아래 env를
설정하고 테스트를 실행합니다.

```bash
BETTER_AUTH_LIVE_SMOKE=1 \
BETTER_AUTH_LIVE_SESSION_URL=https://auth.example.com/api/auth/get-session \
BETTER_AUTH_LIVE_SESSION_TOKEN=... \
pnpm --filter @croco/auth-better-auth test
```

검증 명령:

```bash
pnpm --filter @croco/auth-better-auth test
pnpm docs:catalog:check
pnpm public-api:check
```

## API 레퍼런스

| API                                          | 설명                                                      |
| -------------------------------------------- | --------------------------------------------------------- |
| `BetterAuthFactory`                          | Better Auth 인스턴스를 생성하고 재사용합니다.             |
| `BetterAuthDiagnosticsProvider`              | readiness와 missing config를 secret 없이 보고합니다.      |
| `BetterAuthProvider`                         | 요청 헤더에서 세션을 읽어 `AuthUser`로 변환합니다.        |
| `BetterAuthSessionManager`                   | 세션 조회, 단건 해제, 사용자 전체 세션 해제를 처리합니다. |
| `BetterAuthWebhookProcessor`                 | 웹훅 서명을 확인하고 이벤트 핸들러를 호출합니다.          |
| `user`, `session`, `account`, `verification` | Better Auth용 Drizzle 스키마를 제공합니다.                |
| `BetterAuthInvalidSessionProblem` 외 Problem | 세션, 초기화, 웹훅 오류를 Problem으로 표현합니다.         |

## 공개 타입

- `BetterAuthConfig`
- `BetterAuthDiagnosticsConfig`, `BetterAuthDiagnosticsOptions`
- `BetterAuthSession`, `BetterAuthSessionProvider`
- `BetterAuthWebhookEvent`, `BetterAuthWebhookHandler`, `BetterAuthWebhookOptions`
- `BetterAuthUser`
