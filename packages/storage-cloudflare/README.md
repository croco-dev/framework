# @croco/storage-cloudflare

Cloudflare Images를 기반으로 업로드, 다운로드, 변환 URL 생성을 제공하는 이미지 스토리지 구현체입니다.

## 설치

```bash
pnpm add @croco/storage-cloudflare
```

## 사용법

```typescript
import { CloudflareImagesProvider } from "@croco/storage-cloudflare";

const provider = new CloudflareImagesProvider({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountHash: process.env.CLOUDFLARE_ACCOUNT_HASH!,
  defaultVariant: "public",
});

await provider.put("avatars/user-1.jpg", Buffer.from("image"), {
  contentType: "image/jpeg",
});

const publicUrl = provider.getPublicUrl("avatars/user-1.jpg");
const transformUrl = provider.getTransformUrl("avatars/user-1.jpg", {
  width: 400,
  format: "webp",
  fit: "cover",
});
```

## 설정

| 옵션             | 설명                                 |
| ---------------- | ------------------------------------ |
| `accountId`      | Cloudflare 계정 ID                   |
| `apiToken`       | Images API 토큰                      |
| `accountHash`    | 공개 URL 생성에 쓰는 계정 해시       |
| `defaultVariant` | 기본 variant 이름, 기본값은 `public` |
| `customDomain`   | 커스텀 도메인 사용 시 지정           |
| `signingKey`     | `getSignedUrl()`에 필요한 HMAC 키    |
| `maxUploadBytes` | 스트림 업로드 최대 크기              |
| `ttl`            | 업로드 인텐트 만료 시간, 초 단위     |

## API 레퍼런스

| API                                                  | 설명                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| `CloudflareImagesProvider`                           | 이미지 업로드, 다운로드, 삭제, 메타데이터 조회를 처리합니다.                  |
| `CloudflareImagesDiagnosticsProvider`                | 안전한 설정 상태와 선택적 readiness check 결과를 `HealthStatus`로 노출합니다. |
| `getTransformUrl()`                                  | width, height, fit, format, quality를 Cloudflare 파라미터로 변환합니다.       |
| `getUploadIntent()`                                  | 클라이언트 직접 업로드용 URL과 만료 시간을 돌려줍니다.                        |
| `CLOUDFLARE_IMAGES_OPTIONS`                          | DI 등록용 토큰입니다.                                                         |
| `validateCloudflareImagesOptions()`                  | 필수 설정과 양수 정수 옵션을 검증합니다.                                      |
| `normalizeCloudflareImagesError()`                   | Cloudflare/fetch 실패를 provider 전용 `Problem`으로 정규화합니다.             |
| `CloudflareImagesOptions`                            | 제공자 설정 타입입니다.                                                       |
| `CloudflareUploadResponse`, `CloudflareImageDetails` | Cloudflare 응답 구조 타입입니다.                                              |
| `CloudflareTransformOptions`                         | Cloudflare 고유 변환 옵션 타입입니다.                                         |

## 진단과 readiness

```typescript
import { CloudflareImagesDiagnosticsProvider } from "@croco/storage-cloudflare";

const diagnostics = new CloudflareImagesDiagnosticsProvider({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  accountHash: process.env.CLOUDFLARE_ACCOUNT_HASH,
});

const health = await diagnostics.getHealth();
```

- 필수 설정이 빠지면 `unhealthy` 상태와 `storage-cloudflare/missing-config` 코드가 반환됩니다.
- `readinessCheck`를 넘기지 않으면 외부 API를 호출하지 않고 설정 존재 여부만 `healthy`로 보고합니다.
- `readinessCheck`가 실패하면 `degraded` 상태와 정규화된 provider Problem 코드가 반환됩니다.
- 진단 detail은 토큰, secret, authorization 값을 redaction 처리합니다.

## 실패 코드

| 코드                                    | 의미                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `storage-cloudflare/missing-config`     | `accountId`, `apiToken`, `accountHash` 중 하나가 없음         |
| `storage-cloudflare/validation-failed`  | 4xx 응답, 잘못된 TTL, 서명 키 누락 등 복구 불가능한 입력 실패 |
| `storage-cloudflare/retryable-upstream` | 408, 425, 429, 5xx 또는 네트워크 계열 재시도 가능 실패        |
| `storage-cloudflare/terminal-upstream`  | 재시도 대상으로 분류되지 않는 Cloudflare/fetch 실패           |

## 선택적 live smoke

기본 테스트는 실제 Cloudflare 자격 증명을 요구하지 않습니다. 실제 backend readiness를 확인하려면 아래 환경 변수를 모두 설정한 뒤 live smoke를 opt-in 합니다.

```bash
CROCO_LIVE_CLOUDFLARE_IMAGES=1 \
CLOUDFLARE_ACCOUNT_ID=... \
CLOUDFLARE_API_TOKEN=... \
CLOUDFLARE_ACCOUNT_HASH=... \
pnpm --filter @croco/storage-cloudflare test -- CloudflareImagesLiveSmoke
```

## 동작 메모

- Cloudflare Images는 이미지 전용 서비스입니다.
- `put(key)`는 `key`를 Cloudflare Images의 custom ID로 전달하고, 응답의 `result.id`가 같은 값일 때만 성공합니다. buffer와 stream 업로드에 동일하게 적용됩니다.
- custom ID는 well-formed Unicode여야 하고 Unicode code point 기준 1,024자를 초과할 수 없습니다. 위반한 key는 stream 소비나 네트워크 요청 전에 `storage-cloudflare/validation-failed`로 거부됩니다.
- delivery URL은 custom ID의 `/` subpath를 유지하면서 각 segment를 인코딩합니다. 따라서 key에 포함된 `%`는 URL에서 `%25`로 표현됩니다. 관리 API의 조회/삭제 경로는 전체 ID를 하나의 path parameter로 인코딩합니다.
- `StorageProvider`의 `list()` 계약은 아직 존재하지 않으므로 provider도 목록 조회를 제공하지 않습니다.
- `put()`의 `contentType`은 업로드 파일 MIME으로만 전달됩니다. `getMetadata()`는 현재 size와 upload time만 반환하며, content type과 custom metadata 보존은 지원하지 않습니다.
- 서명 URL은 `signingKey`가 없으면 생성할 수 없습니다.
- `inside`는 `scale-down`, `outside`는 `cover`로 매핑합니다.
