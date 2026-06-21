# @croco/storage-r2

Cloudflare R2를 `@croco/storage-core` 인터페이스에 연결하는 스토리지 구현체입니다.

## 설치

```bash
pnpm add @croco/storage-r2 @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## 사용법

```typescript
import { R2StorageProvider } from "@croco/storage-r2";

const storage = new R2StorageProvider(configService, logger);

await storage.put("images/logo.png", Buffer.from("content"), {
  contentType: "image/png",
});

const file = await storage.get("images/logo.png");
const signedUrl = await storage.getSignedUrl("images/logo.png", { expiresIn: 3600 });
```

## 설정

필수 설정 키:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

선택 설정 키:

- `R2_PUBLIC_URL_BASE`

`R2_ACCESS_KEY_ID`와 `R2_SECRET_ACCESS_KEY`는 diagnostics, Problem details, 테스트 리포트에
값으로 노출되지 않습니다. 운영 readiness는 값 대신 `hasAccessKeyId`, `hasSecretAccessKey`,
`missingConfig` 같은 boolean/키 이름 evidence로 확인합니다.

## Diagnostics / Readiness

`R2StorageDiagnosticsProvider`는 필수 R2 설정 존재 여부와 선택적 live readiness check 결과를
`@croco/diagnostics-core`의 `DiagnosticsProvider` 형태로 노출합니다.

```typescript
import { R2StorageDiagnosticsProvider } from "@croco/storage-r2";

const diagnostics = new R2StorageDiagnosticsProvider({
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
});

const health = await diagnostics.getHealth();
```

기본 diagnostics는 Cloudflare R2에 네트워크 요청을 보내지 않습니다. live readiness가 필요하면
`readinessCheck`를 주입합니다. check 실패는 `degraded` 상태와
`STORAGE_R2_READINESS_FAILED` Problem evidence로 보고되며, healthy fallback으로 숨기지 않습니다.
반환되는 details는 secret, token, password, api key, access key 계열 키를 자동으로 redaction합니다.

## API 레퍼런스

| API                       | 설명                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `R2StorageProvider`       | 업로드, 다운로드, 스트림 조회, 삭제, 메타데이터 조회를 제공합니다. |
| `R2_OPTIONS`              | DI 등록용 토큰입니다.                                              |
| `R2Options`               | 계정, 버킷, 공개 URL 설정 타입입니다.                              |
| `MissingR2ConfigProblem`  | 필수 설정이 없을 때 발생합니다.                                    |
| `R2ReadinessProblem`      | live R2 readiness check가 upstream 실패를 감지했을 때 발생합니다.  |
| `EmptyR2BodyProblem`      | 다운로드 응답 본문이 비었을 때 발생합니다.                         |
| `R2ObjectTooLargeProblem` | `get()`으로 10MB 초과 객체를 읽으려 할 때 발생합니다.              |

## 동작 메모

- 버퍼 업로드와 다운로드는 최대 3회 재시도합니다.
- `get()`은 메모리 사용량 보호를 위해 10MB까지만 허용합니다.
- 큰 파일은 `getStream()`을 사용하세요.

## 검증

기본 검증은 R2 credential 없이 실행됩니다.

```bash
pnpm --filter @croco/storage-r2 test
pnpm docs:catalog:check
```

`@croco/testing`의 `createStorageProviderConformanceSuite()`를 사용해 put/get/delete,
stream read, metadata preservation, not-found behavior, invalid key handling, public/signed URL
generation을 mocked R2 backend로 검증합니다.

### Optional live smoke

live smoke는 환경 변수가 없으면 skip됩니다.

```bash
R2_ACCOUNT_ID=... \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
R2_BUCKET=... \
pnpm --filter @croco/storage-r2 test -- src/tests/R2LiveSmoke.spec.ts
```

이 smoke는 configured bucket에 `HeadBucket`을 수행하는 read-only readiness check만 수행합니다.
실제 R2 credential로 이 smoke가 통과한 evidence가 기록되기 전까지 package catalog maturity는 beta로
유지합니다.
