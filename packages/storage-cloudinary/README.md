# @croco/storage-cloudinary

Cloudinary 기반 스토리지 및 이미지 변환 제공자 구현체입니다.

## 특징

- **이미지/동영상 관리**: Cloudinary SDK를 통한 파일 업로드, 다운로드, 삭제
- **실시간 변환**: CDN 기반 이미지 리사이징, 크롭, 포맷 변환
- **클라이언트 직접 업로드**: 서버를 통하지 않는 클라이언트 업로드 지원
- **재시도 정책**: 일시적 네트워크 오류 자동 재시도
- **Problem Details**: RFC 7807 기반 구조화된 에러 처리

## 설치

```bash
pnpm add @croco/storage-cloudinary cloudinary
```

## 사용법

### 기본 설정

```typescript
import { Container } from '@croco/framework-context';
import { CloudinaryProvider, CLOUDINARY_CONFIG } from '@croco/storage-cloudinary';

const provider = new CloudinaryProvider({
  cloudName: 'your-cloud-name',
  apiKey: 'your-api-key',
  apiSecret: 'your-api-secret',
  secure: true,
  ttl: 3600,
});

// DI 컨테이너에 등록
Container.register(CLOUDINARY_CONFIG, provider);
```

### 파일 업로드

```typescript
const buffer = fs.readFileSync('image.jpg');
await provider.put('uploads/image.jpg', buffer, {
  contentType: 'image/jpeg',
  metadata: { alt: '이미지 설명', author: '작성자' },
});
```

### 파일 다운로드

```typescript
const buffer = await provider.get('uploads/image.jpg');
```

### 이미지 변환 URL 생성

```typescript
const url = provider.getTransformUrl('uploads/image.jpg', {
  width: 800,
  height: 600,
  fit: 'cover',
  quality: 80,
  format: 'webp',
});

// 결과: https://res.cloudinary.com/your-cloud/image/upload/w_800,h_600,c_fill,q_80,f_webp/uploads/image.jpg
```

### 클라이언트 직접 업로드

```typescript
const intent = await provider.getUploadIntent('uploads/client-upload.jpg');

console.log(intent.uploadUrl);
console.log(intent.publicUrl);
console.log(intent.expiresAt);

// 클라이언트에서 intent.uploadUrl로 직접 업로드
```

## API

### CloudinaryProvider

`StorageProvider`와 `ImageProvider` 인터페이스를 구현합니다.

#### Methods

- `put(key, data, options?)`: 파일 업로드
- `get(key)`: 파일 다운로드 (Buffer)
- `getStream(key)`: 파일 스트림 다운로드
- `delete(key)`: 파일 삭제
- `exists(key)`: 파일 존재 여부 확인
- `getPublicUrl(key)`: 공개 URL 반환
- `getSignedUrl(key, options)`: 서명된 URL 반환
- `getMetadata(key)`: 파일 메타데이터 조회
- `getTransformUrl(key, options)`: 변환된 이미지 URL 반환
- `getUploadIntent(key)`: 클라이언트 직접 업로드 의도 생성

### CloudinaryConfig

```typescript
type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  secure?: boolean;
  uploadBaseUrl?: string;
  ttl?: number;
};
```

### TransformOptions

```typescript
type TransformOptions = {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png' | 'auto';
  dpr?: number;
};
```

## Fit 모드 매핑

| storage-core | Cloudinary |
|--------------|------------|
| cover        | fill       |
| contain      | fit        |
| fill         | pad        |
| inside       | limit      |
| outside      | crop       |

## 에러 처리

```typescript
import {
  UploadFailedProblem,
  FileNotFoundProblem,
  DeleteFailedProblem,
  InvalidKeyProblem,
} from '@croco/storage-core';

try {
  await provider.get('non-existent.jpg');
} catch (error) {
  if (error instanceof FileNotFoundProblem) {
    console.error('파일을 찾을 수 없습니다:', error.code);
  }
}
```

## 재시도 정책

다음 상황에서 자동 재시도됩니다:

- HTTP 상태: 408, 425, 429, 500, 502, 503, 504
- 에러 코드: `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND` 등
- 에러 메시지: "timeout", "rate limit", "try again" 등 포함

재시도 설정:
- 최대 시도: 3회
- 지수 백오프: 10ms → 20ms → 50ms
- 404 에러는 재시도하지 않음

## 라이선스

MIT