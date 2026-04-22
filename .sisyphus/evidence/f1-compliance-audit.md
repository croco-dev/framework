# F1 Plan Compliance Audit — abc-group-refactoring

작성일: 2026-03-18

## 최종 판정

- **결론: REJECT**
- **사유:** T1-T15 전체가 완전 불합격은 아니지만, **T5 Acceptance Criteria가 100% 충족되지 않음**
- **요약:** T1-T4, T6-T15는 검증한 Acceptance Criteria 기준으로 통과. **T5는 `packages/telemetry-sdk-node/src/runtime.ts`에 `localhost` 문자열이 1건 남아 있어 실패**.

## 실행한 검증

- 패키지별 `pnpm typecheck --filter=...` 실행
- 패키지별 `pnpm test --filter=...` 실행
- 플랜에 명시된 `grep` 기반 Acceptance Criteria 실행
- `gh issue view 326 -R croco-dev/framework --json state,comments` 실행

## 태스크별 Acceptance Criteria 감사 결과

| Task | 판정 | 근거 |
|---|---|---|
| T1 ILogger | PASS | `packages/framework-context/src/libs/ILogger.ts` 존재, `LOGGER_TOKEN` export 확인, `framework-context`/`framework-logger` typecheck 통과, `Logger implements ILogger` 확인 |
| T2 LoggingInterceptor | PASS | `protocols-rest/src/` 내 `framework-logger` import 0건, `LoggingInterceptor.ts`의 `Container.get` 0건, `@croco/protocols-rest` typecheck/test 통과 |
| T3 BatchLoad | PASS | `repository-core/src/` 내 `@croco/dataloader-core` import 0건, `@croco/repository-core`/`@croco/dataloader-core` typecheck 통과, `@croco/repository-core` test 통과 |
| T4 Container.get 제거 | PASS | 대상 5개 파일에서 `= Container.get(` 0건, `@croco/transports-http`/`@croco/audit-core`/`@croco/analytics-posthog` typecheck 통과, 관련 test 통과 |
| T5 OTLP endpoint 필수화 | **FAIL** | `grep -c "localhost" packages/telemetry-sdk-node/src/runtime.ts` 결과 **1**. `lambda.ts`는 0건이고 test는 통과했지만, 플랜 AC의 “runtime.ts 결과 0건”을 충족하지 못함 |
| T6 PostHog host 필수화 | PASS | `packages/integrations-posthog/src/` 내 `us.i.posthog.com` 0건, `@croco/integrations-posthog` test 통과 |
| T7 InMemoryCache maxEntries | PASS | 코드상 기본값 1000 적용 및 `console.warn` 경고 확인, `@croco/cache-core` test 통과 |
| T8 Upload TTL 설정 추출 | PASS* | Cloudinary/Cloudflare provider가 `ttl` 설정을 읽고 `getUploadIntent()`에서 사용함, `@croco/storage-core` typecheck 통과, `@croco/storage-cloudinary`/`@croco/storage-cloudflare` test 통과 |
| T9 BatchLoader 로깅 | PASS | `BatchLoader.ts`에 `recordError`/`logger.warn` 존재, `@croco/dataloader-core` test 통과 |
| T10 Auditable 로깅 | PASS | `.catch(() => undefined)` 0건, `recordError`/`logger.warn` 존재, `@croco/audit-core` test 통과 |
| T11 PolarBillingGateway 로깅 | PASS | not-found catch에서 `logger.warn` + `recordError` 확인, `customers.create()` 유지, `@croco/billing-polar` test 통과 |
| T12 Cloudflare null guard | PASS* | `ProblemFactory.internalServerError(...)` 2건 확인, `@croco/storage-cloudflare` typecheck/test 통과 |
| T13 TaskRunner fallback 로깅 | PASS | DI 실패 경로에서 `logger.warn` + `recordError` + `new taskClass()` 유지 확인, `@croco/tasks-core` test 통과 |
| T14 MiddlewareProblem 전환 | PASS | `MiddlewareChain.ts`의 `new Error` 0건, `MiddlewareProblem extends Problem`, `readonly code/category` 확인, `@croco/framework-context` typecheck/test 통과 |
| T15 #326 duplicate close | PASS | `gh issue view 326` 결과 `state=CLOSED`, 코멘트 `Duplicate of #478` 확인 |

## 핵심 명령 결과

### T5 실패 근거

```bash
$ grep -c "localhost" packages/telemetry-sdk-node/src/runtime.ts
1

$ grep -c "localhost" packages/telemetry-sdk-node/src/libs/presets/lambda.ts
0
```

문제 문자열:

```ts
'For local development, run an OTLP collector on localhost:4318.'
```

플랜의 Acceptance Criteria는 `runtime.ts`에서 `localhost` 결과 0건을 요구하므로, 현재 구현은 **AC 기준 실패**다.

## 패키지 검증 결과 요약

### typecheck

- PASS: `@croco/framework-context`
- PASS: `@croco/framework-logger`
- PASS: `@croco/protocols-rest`
- PASS: `@croco/repository-core`
- PASS: `@croco/dataloader-core`
- PASS: `@croco/transports-http`
- PASS: `@croco/audit-core`
- PASS: `@croco/analytics-posthog`
- PASS: `@croco/storage-core`
- PASS: `@croco/storage-cloudflare`

### test

- PASS: `@croco/protocols-rest`
- PASS: `@croco/repository-core`
- PASS: `@croco/transports-http`
- PASS: `@croco/audit-core`
- PASS: `@croco/analytics-posthog`
- PASS: `@croco/telemetry-sdk-node`
- PASS: `@croco/integrations-posthog`
- PASS: `@croco/cache-core`
- PASS: `@croco/storage-cloudinary`
- PASS: `@croco/storage-cloudflare`
- PASS: `@croco/dataloader-core`
- PASS: `@croco/billing-polar`
- PASS: `@croco/tasks-core`
- PASS: `@croco/framework-context`

## 계획 대비 추가 관찰 사항

### T8

- Acceptance Criteria는 충족하는 것으로 보이지만, 플랜 본문에 있던 “`UploadIntent` 또는 관련 타입에 `expiresIn?: number` 추가”는 현재 구현에서 확인되지 않았다.
- 실제 구현은 `UploadIntent` 타입 변경 대신 provider 설정(`ttl`)을 통해 TTL을 주입하는 방식이다.

### T12

- null guard 자체와 test/typecheck는 통과했다.
- 다만 플랜 본문 예시는 에러 코드를 `CLOUDFLARE_IMAGES_NULL_RESULT`로 제시했는데, 현재 구현은 `cloudflare/images-null-result`를 사용한다.
- 즉 **AC는 통과**, 하지만 플랜 예시와는 불일치가 있다.

## 최종 요약

- **Acceptance Criteria 100% 통과 여부:** **아니오**
- **실패 항목:** **T5**
- **블로커:** `packages/telemetry-sdk-node/src/runtime.ts` 내 `localhost` 문자열 잔존
