# @croco/storage-r2

Cloudflare R2 기반 파일 스토리지 제공자 구현체입니다.

## 목적

`@croco/storage-core`의 `StorageProvider` 인터페이스를 Cloudflare R2(S3-compatible API)로 구현합니다. AWS SDK를 사용하여 R2와 통신하며, 재시도, 서명된 URL 생성, 공개 URL 생성 등의 기능을 제공합니다.

## 설치

```bash
pnpm add @croco/storage-r2
```

## 필수 환경 변수

```bash
R2_ACCOUNT_ID=<your-account-id>
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
R2_BUCKET=<your-bucket-name>
R2_PUBLIC_URL_BASE=<optional-custom-domain>  # 선택사항
```

## 사용 예시

### 기본 사용법

```typescript
import { Container, Component } from '@croco/framework-context';
import { R2StorageProvider } from '@croco/storage-r2';

// R2StorageProvider는 Component 데코레이터로 DI 컨테이너에 자동 등록됩니다
@Component()
class FileService {
  constructor(private readonly storage: R2StorageProvider) {}

  async uploadFile(key: string, data: Buffer) {
    await this.storage.put(key, data, {
      contentType: 'image/png',
      metadata: { uploadedBy: 'user123' }
    });
  }

  async downloadFile(key: string): Promise<Buffer> {
    return this.storage.get(key);
  }

  async getPublicUrl(key: string): string {
    return this.storage.getPublicUrl(key);
  }
}
```

### 서명된 URL 생성

```typescript
// 임시 접근 URL 생성 (예: 1시간 후 만료)
const signedUrl = await storage.getSignedUrl('private/file.pdf', {
  expiresIn: 3600
});
```

### 스트림 다운로드

```typescript
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

const stream = await storage.getStream('large/file.zip');
await pipeline(stream, createWriteStream('./local-file.zip'));
```

## API 레퍼런스

### R2StorageProvider

#### `put(key: string, data: Buffer | Readable, options?: PutOptions): Promise<void>`

파일을 업로드합니다.

**매개변수:**
- `key`: 파일 식별자 (예: `'images/photo.png'`)
- `data`: 업로드할 데이터 (`Buffer` 또는 `Readable` 스트림)
- `options`: 업로드 옵션
  - `contentType`: Content-Type 헤더 (MIME type)
  - `cacheControl`: Cache-Control 헤더
  - `metadata`: 사용자 정의 메타데이터 객체

**에러:**
- `InvalidKeyProblem`: 키가 유효하지 않을 때
- `UploadFailedProblem`: 업로드 실패 시

#### `get(key: string): Promise<Buffer>`

파일을 메모리에 버퍼로 다운로드합니다. 10MB 이상의 파일은 `R2ObjectTooLargeProblem`을 발생시킵니다.

**에러:**
- `FileNotFoundProblem`: 파일이 존재하지 않을 때
- `R2ObjectTooLargeProblem`: 파일이 10MB 한도를 초과할 때

#### `getStream(key: string): Promise<Readable>`

파일을 Readable 스트림으로 다운로드합니다. 대용량 파일 다운로드에 적합합니다.

**에러:**
- `FileNotFoundProblem`: 파일이 존재하지 않을 때
- `EmptyR2BodyProblem`: 응답 본문이 비어있을 때

#### `delete(key: string): Promise<void>`

파일을 삭제합니다.

**에러:**
- `DeleteFailedProblem`: 삭제 실패 시

#### `getPublicUrl(key: string): string`

공개적으로 접근 가능한 URL을 반환합니다.

- `R2_PUBLIC_URL_BASE`가 설정된 경우: `{R2_PUBLIC_URL_BASE}/{key}`
- 설정되지 않은 경우: `https://{bucket}.{accountId}.r2.dev/{key}`

#### `getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>`

임시 접근 가능한 서명된 URL을 생성합니다.

**매개변수:**
- `key`: 파일 식별자
- `options.expiresIn`: URL 만료 시간 (초 단위)

#### `getMetadata(key: string): Promise<ObjectMetadata>`

파일의 메타데이터를 조회합니다.

**반환값:**
```typescript
{
  size: number;              // 파일 크기 (바이트)
  contentType?: string;      // MIME type
  lastModified: Date;        // 마지막 수정 시간
  etag?: string;             // ETag 값
  metadata?: Record<string, string>;  // 사용자 정의 메타데이터
}
```

#### `exists(key: string): Promise<boolean>`

파일 존재 여부를 확인합니다. (BaseStorageProvider에서 상속)

## Problem 클래스

### MissingR2ConfigProblem

필수 환경 변수가 누락되었을 때 발생합니다.

```typescript
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET 중 하나가 누락
throw new MissingR2ConfigProblem('R2_ACCOUNT_ID');
```

### EmptyR2BodyProblem

R2 응답 본문이 비어있을 때 발생합니다.

### R2ObjectTooLargeProblem

`get()` 메서드로 다운로드하려는 객체가 10MB 한도를 초과할 때 발생합니다. 대용량 파일은 `getStream()`을 사용하세요.

## 재시도 정책

R2StorageProvider는 자동 재시도를 지원합니다:

- **Transient HTTP 상태 코드**: 408, 425, 429, 500, 502, 503, 504
- **Transient 에러 코드**: ECONNABORTED, ECONNRESET, ETIMEDOUT, SlowDown, Throttling 등

재시도 설정:
- 최대 시도 횟수: 3회
- 초기 지연: 10ms
- 백오프 배수: 2x
- 최대 지연: 50ms
- 지터: 없음

**주의**: 스트림 업로드(Readable)는 재시도되지 않습니다. 버퍼 업로드만 재시도됩니다.

## 타입

### R2Options

```typescript
type R2Options = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrlBase?: string;
};
```

## 라이선스

MIT
