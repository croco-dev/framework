# @croco/storage-cloudinary

Cloudinary를 이용해 파일 저장, 공개 URL, 변환 URL, 업로드 인텐트를 제공하는 구현체입니다.

## 설치

```bash
pnpm add @croco/storage-cloudinary cloudinary
```

## 사용법

### Application plugin

```typescript
import { cloudinaryStorage } from "@croco/storage-cloudinary";
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";

const runtime = createApplicationRuntime(
  defineCrocoApplication({
    imports: [
      cloudinaryStorage({
        cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
        apiKey: process.env.CLOUDINARY_API_KEY!,
        apiSecret: process.env.CLOUDINARY_API_SECRET!,
      }),
    ],
  }),
);

await runtime.initialize();
```

`cloudinaryStorage()`는 `STORAGE_PROVIDER_TOKEN`과 readiness diagnostics를 같은 inspectable
application graph에 등록합니다. 초기화만으로 Cloudinary API를 호출하지 않습니다.

```typescript
import { CloudinaryProvider } from "@croco/storage-cloudinary";

const provider = new CloudinaryProvider({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  apiKey: process.env.CLOUDINARY_API_KEY!,
  apiSecret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

await provider.put("uploads/hero.jpg", new TextEncoder().encode("image"), {
  contentType: "image/jpeg",
  metadata: { owner: "team-a" },
});

const transformed = provider.getTransformUrl("uploads/hero.jpg", {
  width: 1200,
  height: 630,
  fit: "cover",
  format: "webp",
});

const intent = await provider.getUploadIntent("uploads/avatar", { ttlInSeconds: 300 });
const form = new FormData();

for (const [name, value] of Object.entries(intent.fields ?? {})) {
  form.append(name, value);
}
form.append("file", file);

const response = await fetch(intent.uploadUrl, {
  method: "POST",
  body: form,
});
```

`CloudinaryProvider`는 전체 객체 lifecycle에서 이미지 리소스만 지원합니다. `image/*` MIME 또는 생략된
`contentType`은 Cloudinary `image` namespace에 저장되며, `video/*`와 raw MIME은 bytes를 업로드하기 전에
`storage-cloudinary/validation-failed`로 거부됩니다.

## 설정

| 옵션            | 설명                                              |
| --------------- | ------------------------------------------------- |
| `cloudName`     | Cloudinary 클라우드 이름                          |
| `apiKey`        | API 키                                            |
| `apiSecret`     | API 시크릿                                        |
| `secure`        | HTTPS 사용 여부, 기본값은 `true`                  |
| `uploadBaseUrl` | 업로드 인텐트 생성 시 사용할 API 기준 URL         |
| `apiBaseUrl`    | 서버 측 Cloudinary API 요청에 사용할 API 기준 URL |
| `ttl`           | 업로드 인텐트 만료 시간, 1-3600초                 |

## API 레퍼런스

| API                                 | 설명                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `CloudinaryProvider`                | 업로드, 다운로드, 삭제, 메타데이터 조회와 변환 URL 생성을 담당합니다.         |
| `CloudinaryDiagnosticsProvider`     | 안전한 설정 상태와 선택적 readiness check 결과를 `HealthStatus`로 노출합니다. |
| `CLOUDINARY_CONFIG`                 | DI 등록용 토큰입니다.                                                         |
| `validateCloudinaryConfig()`        | 필수 설정과 양수 정수 옵션을 검증합니다.                                      |
| `normalizeCloudinaryStorageError()` | Cloudinary/fetch 실패를 provider 전용 `Problem`으로 정규화합니다.             |
| `CloudinaryConfig`                  | 제공자 설정 타입입니다.                                                       |
| `CloudinaryUploadOptions`           | 업로드 확장 옵션 타입입니다.                                                  |
| `CloudinaryTransformOptions`        | 변환 파라미터 타입입니다.                                                     |

## 진단과 readiness

```typescript
import { CloudinaryDiagnosticsProvider } from "@croco/storage-cloudinary";

const diagnostics = new CloudinaryDiagnosticsProvider({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
});

const health = await diagnostics.getHealth();
```

- 필수 설정이 빠지면 `unhealthy` 상태와 `storage-cloudinary/missing-config` 코드가 반환됩니다.
- `readinessCheck`를 넘기지 않으면 외부 API를 호출하지 않고 설정 존재 여부만 `healthy`로 보고합니다.
- `readinessCheck`가 실패하면 `degraded` 상태와 정규화된 provider Problem 코드가 반환됩니다.
- 진단 detail은 토큰, secret, authorization 값을 redaction 처리합니다.
- 진단 detail의 `acceptedResourceTypes`는 현재 지원 계약인 `["image"]`를 반환합니다.

## 실패 코드

| 코드                                    | 의미                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| `storage-cloudinary/missing-config`     | `cloudName`, `apiKey`, `apiSecret` 중 하나가 없음      |
| `storage-cloudinary/validation-failed`  | 400, 401, 403, 422 응답 또는 잘못된 설정/입력 실패     |
| `storage-cloudinary/retryable-upstream` | 408, 425, 429, 5xx 또는 네트워크 계열 재시도 가능 실패 |
| `storage-cloudinary/terminal-upstream`  | 재시도 대상으로 분류되지 않는 Cloudinary/fetch 실패    |

## 선택적 live smoke

기본 테스트는 실제 Cloudinary 자격 증명을 요구하지 않습니다. 실제 backend readiness와 이미지 lifecycle을 확인하려면 아래 환경 변수를 모두 설정한 뒤 live smoke를 opt-in 합니다. Lifecycle smoke는 이미지를 업로드하고 provider를 재생성한 뒤 조회, 존재 확인, 메타데이터 조회, 삭제를 검증합니다.

```bash
CROCO_LIVE_CLOUDINARY=1 \
CLOUDINARY_CLOUD_NAME=... \
CLOUDINARY_API_KEY=... \
CLOUDINARY_API_SECRET=... \
pnpm --filter @croco/storage-cloudinary test -- CloudinaryLiveSmoke
```

## 동작 메모

- `cover`, `contain`, `fill`, `inside`, `outside`를 Cloudinary crop 값으로 변환합니다.
- 일시적 네트워크 오류와 5xx 응답은 최대 3회 재시도합니다.
- 업로드 인텐트는 직접 업로드 엔드포인트, 공개 URL, `public_id`, `timestamp`, `api_key`, `signature` multipart 필드를 반환합니다. API secret은 반환하지 않으며 Cloudinary의 서명 유효 시간에 맞춰 TTL은 최대 1시간입니다.
- Cloudinary image `public_id` 규칙에 맞춰 직접 업로드 key의 마지막 경로에는 파일 확장자를 포함하지 않습니다. 파일 이름의 확장자는 multipart `file`에만 사용합니다.
- 성공한 업로드는 항상 `image` namespace를 사용하므로 provider 재생성 후에도 조회, 존재 확인, 메타데이터 조회,
  삭제가 같은 key로 동작합니다.
- `StorageProvider`의 `list()` 계약은 아직 존재하지 않으므로 provider도 목록 조회를 제공하지 않습니다.
- custom metadata는 Cloudinary context로 보존됩니다. `getMetadata().contentType`은 원래 MIME 전체가 아니라 Cloudinary resource `format` 값입니다.
