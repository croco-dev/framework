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

await storage.put("images/logo.png", new TextEncoder().encode("content"), {
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

- 재사용 가능한 `Uint8Array` 업로드와 다운로드 요청은 최대 3회 재시도합니다.
- Web `ReadableStream<Uint8Array>` 업로드는 소비 후 재사용할 수 없으므로 재시도하지 않습니다.
- `get()`은 메모리 사용량 보호를 위해 10MB까지만 허용합니다.
- `getStream()`은 R2 응답을 Web Stream으로 직접 노출하므로 큰 파일을 전체 버퍼링하지 않습니다.

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

## Workers R2Bucket 바인딩

`@croco/storage-r2/workers`의 `R2BindingStorageProvider`는 Worker의 R2 binding을 직접 사용합니다.
루트 진입점의 S3 SDK 제공자는 Node/Lambda용으로 유지됩니다. Worker에는 `nodejs_compat`이 필요합니다.

```typescript
import { R2BindingStorageProvider } from "@croco/storage-r2/workers";
import type { R2BucketBinding } from "@croco/storage-r2/workers";

export default {
  async fetch(_request: Request, env: { BUCKET: R2BucketBinding }): Promise<Response> {
    const storage = new R2BindingStorageProvider(env.BUCKET);
    // 실제 앱에서는 인증된 tenant와 객체 접근 권한으로 key를 결정합니다.
    return new Response(await storage.getStream("tenant-a/report.csv"));
  },
};
```

Wrangler에 `compatibility_flags = ["nodejs_compat"]`와 애플리케이션 소유 `BUCKET` R2 바인딩을 선언합니다.
이 adapter는 버킷을 생성하거나 공개로 전환하지 않으며 S3 access key를 요구하지 않습니다.
바인딩은 현재 Worker callback 안에서 사용하고, 별도 shutdown/flush는 호출하지 않습니다.

- `put/get/getStream/delete/exists/getMetadata`는 공통 storage 계약을 사용합니다. `get`은 10MiB까지
  버퍼링하며 큰 객체는 `getStream`으로 읽습니다. 업로드 스트림은 R2가 요구하는 길이가 알려진
  native stream이어야 합니다. `Request`/`Response` 본문과 `FixedLengthStream`을 사용할 수 있으며,
  길이를 알 수 없는 사용자 스트림은 전체 버퍼링으로 우회하지 않고 binding 오류를 반환합니다.
- `get/getStream`의 선택적 `range`는 `{ offset, length? }`, `{ length }`, `{ suffix }`입니다.
  offset은 0 이상의 안전한 정수이고 length/suffix는 양의 안전한 정수여야 합니다.
- content type, cache control과 custom metadata를 저장합니다. metadata의 ETag는 R2의 `httpEtag`이며
  SHA 또는 transaction 완료 증거로 사용하지 않습니다.
- `getSignedUrl`은 유효한 TTL을 검사한 뒤 `STORAGE_R2_BINDING_UNSUPPORTED`를 반환합니다.
  `put`의 `isPublic`도 지원하지 않습니다. 공개 URL이 필요하면 신뢰할 수 있는 공개 버킷/custom domain의
  `publicUrlBase`를 명시합니다. URL 생성은 접근 권한을 부여하지 않습니다.
- 호출 전 취소는 binding I/O 없이 거절합니다. 진행 중 취소는 대기를 끝내고 read body를 정리하지만
  이미 시작한 저장·삭제의 원격 취소를 보장하지 않습니다. 결과가 불명확하면 현재 객체를 확인한 뒤 복구합니다.
- binding 실패는 원인을 보존한 `STORAGE_R2_BINDING_FAILED`입니다. 공개 Problem JSON에는 upstream
  오류 원문을 넣지 않습니다. 문서화된 native retry 분류가 없으므로 자동 재시도하지 않으며 스트림도 재전송하지 않습니다.
- tenant namespace와 객체 권한은 서버가 검증합니다. adapter에 전달하는 key만으로 권한이 증명되지 않습니다.

기본 `test`는 credential 없이 공통 계약의 데이터·검증·취소 사례와 실제 로컬 workerd R2 fixture를 실행합니다.
서명 URL 성공 사례는 native binding이 지원하지 않으므로 명시적인 미지원 검증으로 대체합니다.
이는 실제 Cloudflare 계정의 인증, 배포 또는 provider certification을 의미하지 않습니다.
기존 S3 readiness live smoke는 명시적 환경 변수로만 선택하며 Worker binding live 검증을 대신하지 않습니다.

외부 계약: [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).
