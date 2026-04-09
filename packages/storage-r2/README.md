# @croco/storage-r2

Cloudflare R2를 `@croco/storage-core` 인터페이스에 연결하는 스토리지 구현체입니다.

## 설치

```bash
pnpm add @croco/storage-r2 @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

## 사용법

```typescript
import { R2StorageProvider } from '@croco/storage-r2';

const storage = new R2StorageProvider(configService, logger);

await storage.put('images/logo.png', Buffer.from('content'), {
  contentType: 'image/png',
});

const file = await storage.get('images/logo.png');
const signedUrl = await storage.getSignedUrl('images/logo.png', { expiresIn: 3600 });
```

## 설정

필수 설정 키:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

선택 설정 키:

- `R2_PUBLIC_URL_BASE`

## API 레퍼런스

| API | 설명 |
|---|---|
| `R2StorageProvider` | 업로드, 다운로드, 스트림 조회, 삭제, 메타데이터 조회를 제공합니다. |
| `R2_OPTIONS` | DI 등록용 토큰입니다. |
| `R2Options` | 계정, 버킷, 공개 URL 설정 타입입니다. |
| `MissingR2ConfigProblem` | 필수 설정이 없을 때 발생합니다. |
| `EmptyR2BodyProblem` | 다운로드 응답 본문이 비었을 때 발생합니다. |
| `R2ObjectTooLargeProblem` | `get()`으로 10MB 초과 객체를 읽으려 할 때 발생합니다. |

## 동작 메모

- 버퍼 업로드와 다운로드는 최대 3회 재시도합니다.
- `get()`은 메모리 사용량 보호를 위해 10MB까지만 허용합니다.
- 큰 파일은 `getStream()`을 사용하세요.
