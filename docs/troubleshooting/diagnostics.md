# 자기 진단(Self-Diagnosing) 서브시스템 가이드

## 목표

Croco 프레임워크 운영 중 발생하는 내부 상태 불일치, 컴포넌트 초기화 실패, 성능 저하 등의 문제를 실행 환경 내에서 실시간으로 파악할 수 있도록 돕습니다.

## 배경: 자기 진단 서브시스템이란

자기 진단 서브시스템은 프레임워크를 구성하는 주요 컴포넌트(Container, EventBus, Telemetry 등)가 스스로의 건강 상태와 오류 내역을 중앙 집중식으로 리포팅하는 기능입니다.
외부 관측(Observability) 시스템의 사각지대나 초기화 과정의 문제를 빠르고 정확하게 진단하기 위해 설계되었습니다.

## 핵심 개념

- **`DiagnosticsProvider`**: 개별 컴포넌트나 모듈의 상태를 진단하고 리포팅하는 인터페이스입니다. 각 시스템 요소는 이 인터페이스를 구현하여 자신의 `HealthStatus`를 제공합니다.
- **`DiagnosticsCollector`**: 등록된 모든 `DiagnosticsProvider`를 순회하며 상태 정보를 수집합니다. 또한 프레임워크 전반에서 발생하는 중요한 내부 에러를 수집합니다.
- **`DiagnosticsReport`**: 수집기(`DiagnosticsCollector`)가 종합한 최종 진단 보고서 데이터 형식입니다. 컴포넌트 상태 배열과 최근 에러 이력을 포함합니다.

## 사용법: HTTP 엔드포인트

웹 서버나 Lambda 환경에서 다음 엔드포인트를 통해 진단 결과를 조회할 수 있습니다.

- **URL**: `GET /health/diagnostics`
- **기본 노출**: off. 명시적으로 `diagnostics.exposure` 또는 `CROCO_DIAGNOSTICS_ENABLED=true`를 설정해야 등록됩니다.
- **캐시 정책**: 모든 성공/거부 응답은 `Cache-Control: no-store`를 포함합니다.

응답 구조 예시:

```json
{
  "timestamp": "2026-05-16T12:00:00.000Z",
  "summary": "degraded",
  "components": [
    {
      "status": "degraded",
      "component": "EventBus",
      "message": "Some events failed to process",
      "details": { "safeKey": "visible", "apiToken": "[Redacted]" },
      "lastChecked": "2026-05-16T12:00:00.000Z"
    }
  ],
  "recentErrors": [
    {
      "timestamp": "2026-05-16T11:55:00.000Z",
      "component": "EventBus",
      "code": "EVENT_PUBLISH_ERROR",
      "message": "Failed to publish event UserCreated. Details: ..."
    }
  ]
}
```

## 운영 endpoint contract

| Endpoint                  | 등록 조건 | 응답 contract                                                                                             | 상태 코드        |
| ------------------------- | --------- | --------------------------------------------------------------------------------------------------------- | ---------------- |
| `GET /health`             | 항상      | `{ "status": "ok" }`                                                                                      | `200`            |
| `GET /health/live`        | 항상      | `{ "status": "ok" }`                                                                                      | `200`            |
| `GET /ready`              | 항상      | `{ "status": "up" \| "down", "results": HealthIndicatorResult[] }`                                        | `200` 또는 `503` |
| `GET /health/ready`       | 항상      | `/ready`와 동일                                                                                           | `200` 또는 `503` |
| `GET /health/diagnostics` | opt-in    | `DiagnosticsReport`에서 redaction 적용 후 반환                                                            | `200` 또는 `403` |
| `GET /diagnostics`        | opt-in    | `/health/diagnostics`와 동일한 표준 경로                                                                  | `200` 또는 `403` |
| `GET /dev/inspector`      | opt-in    | 최근 로컬 요청의 runtime timeline, trace, DI snapshot, event/retry/problem 요약을 redaction 적용 후 반환  | `200` 또는 `403` |
| `GET /metrics`            | 항상      | `{ "timestamp": string, "metrics": { "standardEndpointPathCount": number, "healthCheckCount": number } }` | `200`            |

Readiness는 `@croco/health-core`의 `HealthCheckService` 실행 semantics를 사용합니다.
`@croco/transports-http`의 `HealthCheckRegistry`는 기존 `register(name, fn, options)` API와
HTTP response shape를 유지하면서 health-core에 체크 실행과 timeout/abort 처리를 위임합니다.

## CLI 운영 체크

CI에서는 `croco ops check`를 사용해 운영 endpoint contract를 검증합니다.

```bash
croco ops check http://localhost:3000 \
  --token "$CROCO_DIAGNOSTICS_TOKEN" \
  --json
```

- 기본 체크 대상은 `/health`, `/ready`, `/diagnostics`입니다.
- `--metrics`를 추가하면 선택적으로 `/metrics`도 결과에 포함합니다.
- `--json` 출력은 `target`, `timestamp`, `summary`, `endpoints[]`를 포함합니다. 각 endpoint에는 `name`, `url`, `required`, `httpStatus`, `ok`, `body`, `error`가 포함됩니다.
- required endpoint가 응답하지 않거나 readiness/diagnostics가 실패 상태를 보고하면 프로세스가 non-zero로 종료됩니다.
- SaaS 생성 앱은 `pnpm ops:smoke`로 토큰 보호 diagnostics와 `ops check` contract를 함께 검증합니다.

## 보안 및 에러 제한

- Diagnostics endpoint는 기본적으로 등록되지 않습니다.
- `private` exposure는 private network, local smoke test, internal load balancer 뒤에서만 사용합니다.
- `token` exposure는 기본 헤더 `X-Diagnostics-Token`을 검사합니다. `tokenHeader`로 헤더명을 바꿀 수 있습니다.
- `custom` exposure는 앱이 제공한 guard 함수가 true를 반환할 때만 허용합니다.
- 에러 메시지(`message`)의 노출을 통한 민감 정보 유출을 막기 위해 진단 결과의 오류 메시지는 기본 최대 **100자**로 제한(cap)되며, Stack Trace와 `cause`는 절대 포함되지 않습니다.
- `details` 안의 `token`, `secret`, `password`, `authorization`, `cookie`, `credential`, `api[-_]?key`, `private[-_]?key`, `access[-_]?key`, `connection[-_]?string`, `dsn`, `database[-_]?url`, `redis[-_]?url`, `mongo(db)?[-_]?url`, `postgres(ql)?[-_]?url` 계열 key는 `[Redacted]`로 대체됩니다.
- `recentErrors`는 기본 최대 **100개**를 최신순으로 반환합니다. 저장소는 고정 크기 ring buffer이므로 retention도 최근 100개입니다.

## 환경변수 설정

진단 엔드포인트는 기본적으로 **비활성화**되어 있습니다. 사용하려면 다음 환경변수를 설정해야 합니다.

- `CROCO_DIAGNOSTICS_ENABLED`: `true`로 설정 시 `/health/diagnostics` 라우트가 활성화됩니다.
- `CROCO_DIAGNOSTICS_TOKEN`: 외부에서 이 엔드포인트를 호출할 때 필요한 인증 토큰입니다. 설정 시, 요청 헤더에 반드시 `X-Diagnostics-Token: <토큰값>`을 포함해야 합니다.
- `CROCO_DIAGNOSTICS_EXPOSURE`: `off`, `private`, `token` 중 하나를 설정할 수 있습니다. 앱 코드의 `diagnostics.exposure`가 있으면 앱 코드 설정이 우선합니다.
- `CROCO_DEV_INSPECTOR_ENABLED`: `true`로 설정 시 `NODE_ENV=production`이 아닌 환경에서 `/dev/inspector` 라우트가 활성화됩니다.
- `CROCO_DEV_INSPECTOR_TOKEN`: Dev Inspector를 `token` exposure로 호출할 때 필요한 토큰입니다. 기본 헤더는 `X-Dev-Inspector-Token`입니다.
- `CROCO_DEV_INSPECTOR_EXPOSURE`: `off`, `private`, `token`, `custom` 중 하나를 설정할 수 있습니다. 앱 코드의 `devInspector.exposure`가 있으면 앱 코드 설정이 우선합니다.

새 코드에서는 환경변수보다 `createApp({ diagnostics: ... })` 설정을 권장합니다.

```typescript
const app = createApp({
  controllers: [],
  diagnostics: {
    exposure: "custom",
    guard: ({ header }) => header("X-Internal-Request") === "true",
    recentErrorLimit: 25,
    messageLimit: 80,
  },
});
```

앱이 `WorkflowDiagnosticsProvider`, `TelemetryDiagnosticsProvider`처럼 선택적 패키지의 provider를 사용하는 경우 `diagnostics.providers`에 추가하면 기본 runtime/container/event bus provider와 함께 등록됩니다. 기본 collector 전체를 교체해야 할 때만 `diagnostics.collector`를 직접 전달합니다.

## CROCO\_\* 진단 코드 표준

빌드타임 체크, codegen, doctor, runtime diagnostics가 사람이 읽는 문장만 출력하면 원인과 수정 위치가 바뀔 때 추적하기 어렵습니다. Croco 진단은 안정적인 `CROCO_<AREA>_<NNN>` 코드를 기준으로 같은 메시지 구조를 사용해야 합니다.

표준 메시지 필드:

- `code`: `CROCO_DI_001`, `CROCO_ROUTE_004`처럼 대문자 영역과 세 자리 번호를 사용합니다.
- `severity`: `error`, `warning`, `info` 중 하나입니다. CI/build를 실패시키는 항목은 `error`를 사용합니다.
- `category`: dependency-injection, routing, build-time, runtime, telemetry, events처럼 사용자가 수정 지점을 좁힐 수 있는 영역입니다.
- `location`: 가능한 경우 `file`, `line`, `column`, `packageName`, `symbol`을 포함합니다. 위치를 모르면 `unknown`을 명시합니다.
- `cause`: 무엇이 깨졌는지 한 문장으로 설명합니다.
- `action`: 사용자가 다음에 실행하거나 수정할 복구 액션을 한 문장으로 제시합니다.
- `docs` 또는 `searchKeywords`: 문서 URL이 아직 안정적이지 않으면 코드와 관련 키워드를 함께 제공합니다.

표준 출력 예시:

```text
ERROR CROCO_ROUTE_004 - Route path parameter is not bound
Category: routing
Cause: A route path declares a path parameter but the controller method metadata does not bind that parameter.
Location: packages/api/src/UsersController.ts:12:8#UsersController.getUser (@croco/example-api)
Action: Add the matching path parameter decorator or rename the path token so generated contracts and runtime routing agree.
Docs: docs/troubleshooting/diagnostics.md#croco_route_004
Search: CROCO_ROUTE_004, missing path param, @Param, route contract
```

`@croco/diagnostics-core`는 이 형식을 위한 `DiagnosticCodeDefinition`, `DiagnosticSourceLocation`, `createDiagnosticMessage()`, `formatDiagnosticMessage()`를 제공합니다. 새 check/build/runtime 진단은 같은 필드를 직접 만들거나 이 helper로 포맷해야 합니다.

초기 표준 코드 예시:

| Code              | Category             | Severity | Cause 요약                                  | Recovery action 요약                             |
| ----------------- | -------------------- | -------- | ------------------------------------------- | ------------------------------------------------ |
| `CROCO_DI_001`    | dependency-injection | error    | 등록되지 않은 provider를 resolve함          | provider 등록, module export, optional lookup    |
| `CROCO_ROUTE_004` | routing              | error    | path parameter와 controller metadata 불일치 | `@Param` 추가 또는 path token rename             |
| `CROCO_BUILD_002` | build-time           | error    | generated artifact가 source와 drift됨       | package-specific write command 실행 후 diff 검토 |
| `CROCO_BUILD_003` | build-time           | error    | controller source에 TypeScript 오류가 있음  | controller type error 수정 후 contract 재실행    |

### CLI diagnostic code migration

CLI가 직접 생성하는 diagnostic/Problem의 primary `code`는 `CROCO_*` 형식을 사용합니다. 이전 slash-form 값은 제거된 primary code가 아니라 `legacyCode` alias로만 남깁니다. JSON 출력이나 Problem extension에서 `legacyCode`가 보이면 migration lookup 용도로만 사용하고, 새 suppress/filter/support tooling은 `code`의 `CROCO_*` 값을 기준으로 작성합니다.

Project Map wrapper diagnostics preserve the concrete wrapped source code in `legacyCode`. The wildcard rows below are patterns, not serialized alias values: `project-map/framework-manifest-*` is emitted as `project-map/framework-manifest-<sourceCode>`, and `project-map/contract-graph-*` is emitted as `project-map/contract-graph-<sourceCode>`. Use the emitted `legacyCode` field for exact migration lookup when those wrapper diagnostics appear.

예시:

```text
ERROR CROCO_CLI_DOCTOR_005
  Cause: A Lambda entrypoint initializes @croco/telemetry-sdk-node but does not flush telemetry before the invocation returns.
  Location: packages/api/src/handler.ts:1 (@croco/api)
  Action: Await telemetry readiness before handler work and call telemetry.forceFlush() in a finally block before returning.
```

| Stable code                     | Legacy alias / pattern                    | Surface             | Meaning                                    |
| ------------------------------- | ----------------------------------------- | ------------------- | ------------------------------------------ |
| `CROCO_CLI_DOCTOR_001`          | `doctor/workspace-not-found`              | `croco doctor`      | workspace root를 찾지 못함                 |
| `CROCO_CLI_DOCTOR_002`          | `doctor/workspace-packages-empty`         | `croco doctor`      | workspace glob이 package를 찾지 못함       |
| `CROCO_CLI_DOCTOR_003`          | `doctor/workspace-package-invalid`        | `croco doctor`      | package manifest가 유효하지 않음           |
| `CROCO_CLI_DOCTOR_004`          | `doctor/repository-core-drizzle-boundary` | `croco doctor`      | repository-core가 Drizzle 구현에 오염됨    |
| `CROCO_CLI_DOCTOR_005`          | `doctor/lambda-telemetry-flush-missing`   | `croco doctor`      | Lambda telemetry flush 보장이 없음         |
| `CROCO_CLI_USAGE_DASHBOARD_001` | `usage-dashboard/tenant-required`         | generated dashboard | tenant context 누락                        |
| `CROCO_CLI_USAGE_DASHBOARD_002` | `usage-dashboard/tenant-not-found`        | generated dashboard | tenant lookup 실패                         |
| `CROCO_CLI_USAGE_DASHBOARD_003` | `usage-dashboard/meter-not-found`         | generated dashboard | meter lookup 실패                          |
| `CROCO_CLI_USAGE_DASHBOARD_004` | `usage-dashboard/provider-unavailable`    | generated dashboard | dashboard provider dependency 실패         |
| `CROCO_CLI_OPS_001`             | `cli/invalid-ops-target-url`              | `croco ops`         | ops target URL이 유효하지 않음             |
| `CROCO_CLI_OPS_002`             | `cli/invalid-ops-timeout`                 | `croco ops`         | ops timeout이 유효하지 않음                |
| `CROCO_CLI_JOBS_001`            | `cli/invalid-jobs-target-url`             | `croco jobs`        | jobs target URL이 유효하지 않음            |
| `CROCO_CLI_JOBS_002`            | `cli/invalid-jobs-number`                 | `croco jobs`        | jobs numeric option이 유효하지 않음        |
| `CROCO_CLI_JOBS_003`            | `cli/missing-jobs-target-url`             | `croco jobs`        | jobs target URL이 없음                     |
| `CROCO_CLI_JOBS_004`            | `cli/jobs-http-error`                     | `croco jobs`        | jobs endpoint가 404 외 실패 응답을 반환함  |
| `CROCO_CLI_JOBS_005`            | `cli/jobs-endpoint-not-found`             | `croco jobs`        | jobs endpoint 또는 job id를 찾을 수 없음   |
| `CROCO_CLI_DI_CHECK_001`        | `cli/di-manifest-invalid`                 | `croco di check`    | DI/module manifest를 읽을 수 없음          |
| `CROCO_CLI_DI_CHECK_002`        | `cli/di-manifest-failed`                  | `croco di check`    | failed manifest에 diagnostics가 없음       |
| `CROCO_CLI_DI_CHECK_003`        | `cli/di-diagnostic-unknown`               | `croco di check`    | manifest diagnostic code가 없음            |
| `CROCO_CLI_PROJECT_MAP_001`     | `project-map/framework-manifest-*`        | `croco project map` | framework manifest diagnostic wrapper      |
| `CROCO_CLI_PROJECT_MAP_002`     | `project-map/contract-route-conflict`     | `croco project map` | framework/contract route set 불일치        |
| `CROCO_CLI_PROJECT_MAP_003`     | `project-map/contract-graph-*`            | `croco project map` | Contract Graph diagnostic wrapper          |
| `CROCO_CLI_PROJECT_MAP_004`     | `project-map/runtime-target-missing`      | `croco project map` | runtime target 누락                        |
| `CROCO_CLI_PROJECT_MAP_005`     | `project-map/runtime-target-unsupported`  | `croco project map` | 지원하지 않는 runtime target               |
| `CROCO_CLI_PROJECT_MAP_006`     | `project-map/runtime-capability-conflict` | `croco project map` | runtime capability conflict                |
| `CROCO_CLI_PROJECT_MAP_007`     | `project-map/package-manifest-conflict`   | `croco project map` | provider profile package가 manifest에 없음 |
| `CROCO_CLI_PROJECT_MAP_008`     | `project-map/manifest-missing`            | `croco project map` | committed Project Map manifest 누락        |
| `CROCO_CLI_PROJECT_MAP_009`     | `project-map/manifest-drift`              | `croco project map` | committed Project Map manifest drift       |

### `CROCO_DI_001`

Cause: DI container가 active scope에서 등록되지 않은 provider token을 resolve하려고 했습니다.
Fix: provider를 resolve 전에 등록하고, module boundary를 넘는 provider는 owning module에서 export합니다. 선택 dependency는 명시적인 optional lookup 경로로만 처리합니다.

### `CROCO_ROUTE_004`

Cause: route path에 선언된 parameter와 controller method metadata가 일치하지 않습니다.
Fix: path token과 같은 이름의 `@Param` binding을 추가하거나, generated contract와 runtime route가 같은 이름을 보도록 path token을 rename합니다.

### `CROCO_BUILD_002`

Cause: build-time generated artifact가 현재 source에서 다시 생성한 결과와 다릅니다.
Fix: package-specific write command를 실행하고 generated diff를 검토한 뒤 source change와 함께 commit합니다. public API drift는 `pnpm public-api:write`로 갱신합니다.

### `CROCO_BUILD_003`

Cause: RPC/OpenAPI contract loader가 import하려는 controller source에 TypeScript diagnostic이 있습니다. 이 상태에서 emitted JavaScript를 import하면 type-safe source contract가 아닌 깨진 source에서 contract artifact가 생성될 수 있습니다.
Fix: 출력된 source file, line/column, `TS####` diagnostic을 기준으로 controller type error를 수정한 뒤 `contract:check`, `contract:openapi`, `contract:client`를 다시 실행합니다.

### 변경 정책

- 코드는 append-only입니다. 한번 공개된 `CROCO_*` 코드는 다른 의미로 재사용하거나 이름을 바꾸지 않습니다.
- cause/action 문구, docs link, search keyword, fix example은 더 정확하게 보강할 수 있습니다.
- category나 기본 severity를 바꾸면 downstream suppression, CI gate, 문서 검색이 깨질 수 있으므로 새 코드를 발급합니다.
- 코드 제거가 필요하면 최소 한 릴리스 동안 deprecated로 문서화하고 replacement code를 명시합니다.

## 로컬 Dev Inspector

`@croco/transports-http`는 개발 중 요청 하나의 주요 runtime event를 한 출력으로 확인할 수 있는 `GET /dev/inspector`를 제공합니다.

- 기본 노출은 off입니다. `createApp({ devInspector: { exposure: "private" } })` 또는 `CROCO_DEV_INSPECTOR_ENABLED=true`로 명시적으로 켭니다.
- `private` exposure는 `NODE_ENV=production`에서 등록되지 않습니다. 운영 환경에서 꼭 필요하면 `allowProduction: true`와 `token` 또는 `custom` exposure를 함께 사용해야 합니다.
- 기본 토큰 헤더는 `X-Dev-Inspector-Token`입니다.
- 응답은 `Cache-Control: no-store`를 포함합니다.
- 요청 URL query, headers/query, timeline details 안의 token/secret/password/API key/connection string 계열 key는 `[Redacted]`로 대체됩니다.
- Error/Problem message처럼 key 없이 들어오는 문자열도 `token=...`, `Bearer ...`, DSN/connection URL 형태의 민감 값은 `[Redacted]`로 scrub 처리되며, 문자열은 기본 최대 500자로 잘립니다(`maxStringLength`로 조정 가능).
- Inspector 기록 중 예외가 발생해도 원래 요청 처리와 응답은 유지됩니다. 실패한 instrumentation은 가능한 경우 logger warning으로만 남깁니다.
- Inspector는 인메모리 ring buffer입니다. 프로세스 재시작, Lambda cold start, Worker isolate 교체 시 내용은 초기화됩니다.

```typescript no-check
const app = createApp({
  controllers: [UserController],
  devInspector: {
    exposure: "token",
    token: process.env.CROCO_DEV_INSPECTOR_TOKEN,
    maxRequests: 25,
  },
});
```

Inspector timeline에는 HTTP request start/end, middleware/handler timing, DI container snapshot, trace id, Problem 응답 요약, `@croco/events-inmemory` publish/handler 결과, `@croco/retry-core` retry attempt/wait/success/exhaustion 정보가 포함됩니다. 이벤트 payload와 핸들러 반환 body는 저장하지 않습니다.

## Provider별 진단 정보

각 `DiagnosticsProvider`는 다음과 같은 정보를 수집합니다.

Provider `name`은 collector 안에서 유일해야 합니다. 같은 인스턴스를 다시 등록하는 것은 no-op이지만,
같은 `name`을 가진 다른 provider를 등록하면 `DuplicateDiagnosticsProviderProblem`이 발생합니다.

### TelemetryDiagnosticsProvider

- **수집 정보**: OTel SDK 초기화 여부(`isInitialized`), 현재 샘플링 확률(`probability`)
- **Degraded 조건**: 초기화에 실패하거나 외부 콜렉터 연결 등 추적 시스템 상태가 불안정할 때

### EventBusDiagnosticsProvider

- **수집 정보**: 현재 활성 구독자 수(`subscriberCount`), 누적 발행 횟수(`publishedCount`), 누적 실패 횟수(`failCount`)
- **Degraded 조건**: `failCount`가 비정상적으로 급증하거나 건강 상태가 나빠진 경우

### ContainerDiagnosticsProvider

- **수집 정보**: DI 컨테이너 초기화 여부(`isInitialized`), 등록된 서비스 개수(`registeredServiceCount`), 스코프별(singleton, request 등) 통계(`scopes`)
- **Degraded 조건**: 컨테이너가 정상적으로 초기화되지 않거나 필수 서비스 바인딩이 누락된 경우

### ModuleDiagnosticsProvider

- **수집 정보**: 등록된 모듈의 총 개수(`registeredModuleCount`), 초기화된 모듈 수(`initializedModuleCount`), 모듈별 lifecycle phase, imports/providers/exports/controllers 목록
- **Degraded 조건**: 필수 모듈의 부트스트랩이 실패하거나 초기화가 지연될 때

## ErrorHistoryRingBuffer

최근 발생한 내부 에러는 중앙 `ErrorHistoryRingBuffer`에 수집됩니다.

- 최대 **100개**의 슬롯을 갖는 원형 버퍼(Circular Buffer)로 구현되어 O(1) 성능을 보장하며, OOM(Out Of Memory) 위험이 없습니다.
- 새 에러가 발생하여 100개를 초과할 경우 가장 오래된 에러부터 순차적으로 자동 덮어쓰기 삭제가 일어납니다.
- 진단 리포트의 `recentErrors` 속성을 통해 최신순으로 조회할 수 있습니다.

## AWS Lambda 제약사항

Croco는 AWS Lambda에 최적화된 프레임워크입니다. Lambda 환경에서 진단 서브시스템을 활용할 때 다음 사항을 유의해야 합니다.

- **인메모리 기반**: 모든 통계치와 에러 이력은 메모리 상에 임시로 유지됩니다.
- **Cold Start 리셋**: 새로운 Lambda 컨테이너가 프로비저닝(Cold Start)될 때마다 카운터와 링 버퍼 등 내부 상태는 모두 **리셋(초기화)**됩니다. 따라서 조회된 데이터는 현재 활성화된 특정 Lambda 인스턴스의 라이프사이클 내에서 발생한 정보입니다.

## 런타임별 지원 범위

| Runtime            | 지원 상태 | 비고                                                                                                                                                                        |
| ------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node HTTP server   | 지원      | `app.listen()`으로 실행한 Hono 앱이 동일 endpoint를 제공합니다.                                                                                                             |
| AWS Lambda         | 지원      | `app.lambdaHandler()`가 같은 endpoint contract를 API Gateway 응답으로 반환합니다. In-memory 상태는 Lambda 인스턴스 단위입니다.                                              |
| Cloudflare Workers | 부분 지원 | `@croco/transports-http`의 Node/Lambda adapter endpoint는 직접 사용하지 않습니다. Worker preset/adapter는 Worker `fetch` contract에서 별도 운영 endpoint 연결이 필요합니다. |

## 진단 시나리오 예제

### 시나리오 1: "Telemetry 데이터가 보이지 않을 때"

배포 후 외부 모니터링 대시보드에 Trace 정보가 보이지 않는다면 `/health/diagnostics`를 호출해 봅니다.

- `components` 배열에서 `TelemetryDiagnosticsProvider` 항목을 확인합니다.
- `details.isInitialized`가 `false`라면 환경변수 오류 등으로 인해 OTel SDK 초기화가 이뤄지지 않은 상태입니다.
- 초기화는 성공했지만 `details.probability`가 `0`으로 되어 있다면, 코드 레벨에서 샘플링 확률이 0%로 강제 드롭되고 있는지 확인해야 합니다.

### 시나리오 2: "이벤트가 처리되지 않을 때"

시스템 내에서 기대했던 비동기 이벤트 훅이 동작하지 않으면 다음을 진단합니다.

- `components` 배열에서 `EventBusDiagnosticsProvider` 상태를 점검합니다.
- `details.subscriberCount`가 `0`이라면, 서비스 모듈에서 이벤트 구독용 데코레이터나 함수 등록 과정이 제대로 실행되지 않은 것입니다.
- 반면 `subscriberCount`는 정상이나 `details.failCount`가 지속적으로 증가한다면, `recentErrors` 목록을 통해 어느 단계의 이벤트 핸들링에서 예외가 발생하고 있는지 100자 메시지와 에러 코드로 확인할 수 있습니다.
