# @croco/storage-cloudflare

Cloudflare Images API 기반 스토리지 및 이미지 변환 제공자 구현체입니다.

이 패키지는 **Cloudflare Images**와 통합하여 이미지 업로드, 다운로드, 삭제, 변환 기능을 제공합니다. `@croco/storage-core`의 `StorageProvider` 및 `ImageProvider` 인터페이스를 구현합니다.

## 설치

```bash
pnpm add @croco/storage-cloudflare
```

## 개요

### StorageProvider vs ImageProvider

이 패키지는 두 가지 인터페이스를 모두 구현합니다:

- **StorageProvider**: 원시 파일 저장소 추상화 (업로드, 다운로드, 삭제, 메타데이터 조회)
- **ImageProvider**: CDN 기반 실시간 이미지 변환 (크기 조정, 포맷 변환, 품질 조절)

Cloudflare Images는 이미지 전용 서비스이므로, 이 패키지는 이미지 파일에 최적화되어 있습니다.

## 사용법

### 기본 설정

```typescript
import { CloudflareImagesProvider } from '@croco/storage-cloudflare';

const provider = new CloudflareImagesProvider({
  accountId: 'your-account-id',
  apiToken: 'your-api-token',
  accountHash: 'your-account-hash',
  defaultVariant: 'public',
});
```

### 옵션

```typescript
interface CloudflareImagesOptions {
  accountId: string;
  apiToken: string;
  accountHash: string;
  signingKey?: string;
  customDomain?: string;
  defaultVariant?: string;
  maxUploadBytes?: number;
  ttl?: number;
}
```

| 옵션 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `accountId` | `string` | ✓ | Cloudflare Account ID |
| `apiToken` | `string` | ✓ | Cloudflare API Token (Images API 권한 필요) |
| `accountHash` | `string` | ✓ | Cloudflare Account Hash (공개 URL용) |
| `signingKey` | `string` | | 서명된 URL 생성용 HMAC 키 |
| `customDomain` | `string` | | 커스텀 도메인 (예: `cdn.example.com`) |
| `defaultVariant` | `string` | | 기본 변형 이름 (기본값: `'public'`) |
| `maxUploadBytes` | `number` | | 최대 업로드 크기 (기본값: 10MB) |
| `ttl` | `number` | | Upload Intent TTL (초 단위, 기본값: 3600) |

## 주요 API

### 1. 이미지 업로드 (`put`)

Buffer 또는 Readable 스트림으로 이미지를 업로드합니다.

```typescript
import { Readable } from 'node:stream';

const imageBuffer = Buffer.from('...');

await provider.put('profile.jpg', imageBuffer, {
  contentType: 'image/jpeg',
});

const imageStream = Readable.from(imageBuffer);
await provider.put('profile.jpg', imageStream, {
  contentType: 'image/jpeg',
});
```

### 2. 이미지 다운로드 (`get`, `getStream`)

```typescript
const buffer = await provider.get('profile.jpg');

const stream = await provider.getStream('profile.jpg');
```

### 3. 이미지 삭제 (`delete`)

```typescript
await provider.delete('profile.jpg');
```

### 4. 존재 여부 확인 (`exists`)

```typescript
const exists = await provider.exists('profile.jpg');
```

### 5. 공개 URL (`getPublicUrl`)

```typescript
const url = provider.getPublicUrl('profile.jpg');
// https://imagedelivery.net/{accountHash}/profile.jpg/public
```

### 6. 서명된 URL (`getSignedUrl`)

임시 액세스용 서명된 URL을 생성합니다. `signingKey`가 필요합니다.

```typescript
const url = await provider.getSignedUrl('profile.jpg', {
  expiresIn: 3600,
});
```

### 7. 메타데이터 조회 (`getMetadata`)

```typescript
const metadata = await provider.getMetadata('profile.jpg');
// { size: 2048, lastModified: Date, contentType?: string, etag?: string }
```

### 8. 이미지 변환 (`getTransformUrl`)

Cloudflare CDN에서 실시간으로 이미지를 변환합니다.

```typescript
const url = provider.getTransformUrl('profile.jpg', {
  width: 800,
  height: 600,
  quality: 85,
  format: 'webp',
  fit: 'cover',
});

// https://imagedelivery.net/cdn-cgi/image/width=800,height=600,quality=85,format=webp,fit=cover/{accountHash}/profile.jpg/public
```

#### 변환 옵션

```typescript
interface TransformOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  quality?: number;
  format?: 'webp' | 'avif' | 'jpg' | 'png' | 'auto';
  dpr?: number;
}
```

| 옵션 | 설명 |
|------|------|
| `width` | 대상 너비 (px) |
| `height` | 대상 높이 (px) |
| `fit` | 리사이징 모드 |
| `quality` | 품질 (1-100) |
| `format` | 출력 형식 |
| `dpr` | Device Pixel Ratio (1-3) |

#### Fit 모드 매핑

| storage-core | Cloudflare |
|-------------|------------|
| `cover` | `cover` |
| `contain` | `contain` |
| `fill` | `fill` |
| `inside` | `scale-down` |
| `outside` | `cover` |

### 9. 클라이언트 직접 업로드 (`getUploadIntent`)

클라이언트에서 직접 Cloudflare에 업로드하기 위한 의도를 생성합니다.

```typescript
const intent = await provider.getUploadIntent('new-profile.jpg');

console.log(intent.uploadUrl);
console.log(intent.publicUrl);
console.log(intent.expiresAt);
```

클라이언트에서는 `intent.uploadUrl`에 POST 요청으로 파일을 업로드합니다.

```typescript
const formData = new FormData();
formData.append('file', file);

await fetch(intent.uploadUrl, {
  method: 'POST',
  body: formData,
});
```

## 커스텀 도메인 사용

커스텀 도메인을 설정하면 모든 URL이 해당 도메인을 통해 제공됩니다.

```typescript
const provider = new CloudflareImagesProvider({
  ...options,
  customDomain: 'cdn.example.com',
});

const url = provider.getPublicUrl('profile.jpg');
// https://cdn.example.com/cdn-cgi/imagedelivery/{accountHash}/profile.jpg/public

const transformUrl = provider.getTransformUrl('profile.jpg', { width: 800 });
// https://cdn.example.com/cdn-cgi/image/width=800/{accountHash}/profile.jpg/public
```

## DI 컨테이너 사용

```typescript
import { Container } from '@croco/framework-context';
import { CLOUDFLARE_IMAGES_OPTIONS, CloudflareImagesProvider } from '@croco/storage-cloudflare';

const options = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
  apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  accountHash: process.env.CLOUDFLARE_ACCOUNT_HASH!,
};

Container.registerValue(CLOUDFLARE_IMAGES_OPTIONS, options);
Container.register(CloudflareImagesProvider);

const provider = Container.get(CloudflareImagesProvider);
```

## 오류 처리

이 패키지는 `@croco/problems-core`의 Problem 타입을 사용하여 에러를 발생시킵니다.

| 오류 타입 | 발생 시점 |
|----------|----------|
| `FileNotFoundProblem` | 파일이 존재하지 않을 때 (404) |
| `UploadFailedProblem` | 업로드 실패 시 |
| `DeleteFailedProblem` | 삭제 실패 시 |
| `InvalidKeyProblem` | 유효하지 않은 키일 때 |
| `Problem` | 기타 API 오류 |

```typescript
import {
  FileNotFoundProblem,
  UploadFailedProblem,
  DeleteFailedProblem,
} from '@croco/storage-core';

try {
  await provider.put('profile.jpg', buffer);
} catch (error) {
  if (error instanceof UploadFailedProblem) {
    console.error('Upload failed:', error.message);
  }
}
```

## Cloudflare Images API 제약사항

### 지원되는 기능
- 이미지 업로드 (multipart/form-data)
- 이미지 다운로드
- 이미지 삭제
- 이미지 메타데이터 조회
- 실시간 이미지 변환
- 서명된 URL
- 클라이언트 직접 업로드

### 지원되지 않는 기능
- 비이미지 파일 업로드 (Cloudflare Images는 이미지 전용)
- 폴더 구조 (Cloudflare Images는 플랫 구조)
- 객체 메타데이터 커스터마이징 (Cloudflare API 제약)

## 변환 옵션 확장

Cloudflare는 `storage-core`의 기본 변환 옵션 외에도 추가 옵션을 지원합니다:

```typescript
interface CloudflareTransformOptions {
  width?: number;
  height?: number;
  fit?: 'scale-down' | 'contain' | 'cover' | 'fill';
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'gif';
  dpr?: number;
  sharpen?: number;
  blur?: number;
  rotate?: number;
  grayscale?: boolean;
  invert?: boolean;
}
```

이 확장 옵션은 직접 Cloudflare Images API를 사용할 때 활용할 수 있습니다.

## 관련 패키지

- **[@croco/storage-core](../storage-core/)**: 스토리지 추상화 계층
- **Cloudflare Images 문서**: https://developers.cloudflare.com/images/

## 라이선스

MIT License. Copyright (c) 2026 Croco Team.