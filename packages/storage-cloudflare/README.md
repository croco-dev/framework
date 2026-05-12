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

| API                                                  | 설명                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `CloudflareImagesProvider`                           | 이미지 업로드, 다운로드, 삭제, 메타데이터 조회를 처리합니다.            |
| `getTransformUrl()`                                  | width, height, fit, format, quality를 Cloudflare 파라미터로 변환합니다. |
| `getUploadIntent()`                                  | 클라이언트 직접 업로드용 URL과 만료 시간을 돌려줍니다.                  |
| `CLOUDFLARE_IMAGES_OPTIONS`                          | DI 등록용 토큰입니다.                                                   |
| `CloudflareImagesOptions`                            | 제공자 설정 타입입니다.                                                 |
| `CloudflareUploadResponse`, `CloudflareImageDetails` | Cloudflare 응답 구조 타입입니다.                                        |
| `CloudflareTransformOptions`                         | Cloudflare 고유 변환 옵션 타입입니다.                                   |

## 동작 메모

- Cloudflare Images는 이미지 전용 서비스입니다.
- 서명 URL은 `signingKey`가 없으면 생성할 수 없습니다.
- `inside`는 `scale-down`, `outside`는 `cover`로 매핑합니다.
