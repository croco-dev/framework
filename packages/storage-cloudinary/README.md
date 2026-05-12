# @croco/storage-cloudinary

Cloudinary를 이용해 파일 저장, 공개 URL, 변환 URL, 업로드 인텐트를 제공하는 구현체입니다.

## 설치

```bash
pnpm add @croco/storage-cloudinary cloudinary
```

## 사용법

```typescript
import { CloudinaryProvider } from "@croco/storage-cloudinary";

const provider = new CloudinaryProvider({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME!,
  apiKey: process.env.CLOUDINARY_API_KEY!,
  apiSecret: process.env.CLOUDINARY_API_SECRET!,
  secure: true,
});

await provider.put("uploads/hero.jpg", Buffer.from("image"), {
  contentType: "image/jpeg",
  metadata: { owner: "team-a" },
});

const transformed = provider.getTransformUrl("uploads/hero.jpg", {
  width: 1200,
  height: 630,
  fit: "cover",
  format: "webp",
});
```

## 설정

| 옵션            | 설명                                      |
| --------------- | ----------------------------------------- |
| `cloudName`     | Cloudinary 클라우드 이름                  |
| `apiKey`        | API 키                                    |
| `apiSecret`     | API 시크릿                                |
| `secure`        | HTTPS 사용 여부, 기본값은 `true`          |
| `uploadBaseUrl` | 업로드 인텐트 생성 시 사용할 API 기준 URL |
| `ttl`           | 업로드 인텐트 만료 시간, 초 단위          |

## API 레퍼런스

| API                          | 설명                                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| `CloudinaryProvider`         | 업로드, 다운로드, 삭제, 메타데이터 조회와 변환 URL 생성을 담당합니다. |
| `CLOUDINARY_CONFIG`          | DI 등록용 토큰입니다.                                                 |
| `CloudinaryConfig`           | 제공자 설정 타입입니다.                                               |
| `CloudinaryUploadOptions`    | 업로드 확장 옵션 타입입니다.                                          |
| `CloudinaryTransformOptions` | 변환 파라미터 타입입니다.                                             |

## 동작 메모

- `cover`, `contain`, `fill`, `inside`, `outside`를 Cloudinary crop 값으로 변환합니다.
- 일시적 네트워크 오류와 5xx 응답은 최대 3회 재시도합니다.
- 업로드 인텐트는 직접 업로드 엔드포인트 URL과 공개 URL을 함께 반환합니다.
