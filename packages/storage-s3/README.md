# @croco/storage-s3

AWS S3를 `StorageProvider`에 연결하는 Node/Lambda용 alpha Provider입니다. 로컬 SDK/Host 검증과 실제 AWS 인증·배포·provider certification은 별개입니다.

## 애플리케이션 조합

```typescript typecheck
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { s3Storage } from "@croco/storage-s3";
import { STORAGE_PROVIDER_TOKEN } from "@croco/storage-core";

const runtime = createApplicationRuntime(
  defineCrocoApplication({
    name: "files",
    imports: [
      s3Storage({
        bucket: "application-bucket",
        region: "ap-northeast-2",
        keyPrefix: "app-a/",
      }),
    ],
  }),
);
await runtime.initialize();
const storage = runtime.get(STORAGE_PROVIDER_TOKEN);
await storage.put("report.txt", new TextEncoder().encode("report"), {
  contentType: "text/plain",
  metadata: { source: "application" },
});
const url = await storage.getSignedUrl("report.txt", { expiresIn: 60 });
// 모든 요청·스트림이 끝난 뒤 애플리케이션을 종료합니다.
await runtime.dispose();
```

`credentials`를 생략하면 [AWS SDK 기본 credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html)을 사용합니다. Lambda execution role의 session credentials, Kubernetes IRSA의 `AWS_ROLE_ARN`/`AWS_WEB_IDENTITY_TOKEN_FILE`, workload identity를 SDK가 해석합니다. 애플리케이션이 명시적으로 SDK credential 객체나 갱신 가능한 provider 함수를 전달할 수도 있습니다. permanent key를 코드·manifest에 넣지 마세요. `AWS_PROFILE`과 환경 credential을 함께 설정하면 SDK 우선순위를 따릅니다.

모듈은 앱마다 client를 생성하고 shutdown에서 `destroy()`합니다. Lambda warm invocation 사이에는 runtime/client를 재사용하고 모든 업로드·cleanup과 다운로드 스트림 소비를 invocation 종료 전에 완료하세요. 취소하려면 `signal`을 전달하세요. 재사용 중인 client를 invocation마다 파괴하지 마세요. 단독 사용은 `new S3StorageProvider(options)`와 명시적인 `destroy()`를 지원합니다.

## 객체와 실패 계약

- `put/get/getStream/delete/exists/getMetadata/getSignedUrl/getPublicUrl`이 공통 계약입니다. Web stream과 `Uint8Array`를 사용합니다. 미존재는 `FileNotFoundProblem`, 사전·실행 중 취소는 `StorageOperationAbortedProblem`입니다. 403은 미존재로 숨기지 않습니다.
- namespace는 모든 원격 key와 URL에 literal prefix로 적용합니다. `/`로 끝나는 prefix와 유효한 상대 key를 사용하며 합친 UTF-8 key는 1,024 bytes 이하입니다. prefix는 IAM/tenant authorization을 대체하지 않습니다.
- `S3StorageProvider.get/getStream`의 `range: { start, end? }`는 inclusive byte range입니다. `get`은 결과 전체를 메모리에 모으므로 큰 객체에는 `getStream`을 사용하세요.
- `contentType`, `cacheControl`, 사용자 metadata를 전송하고 S3 ETag를 그대로 반환합니다. ETag를 MD5나 무결성 증명으로 해석하지 않습니다.
- ACL은 보내지 않습니다. `isPublic: true`는 실패합니다. Bucket owner enforced/Block Public Access를 유지하며 public URL은 별도로 허가된 bucket/CDN의 `publicUrlBase`를 명시해야 합니다. URL 생성은 실제 공개 접근을 증명하지 않습니다.
- concrete `S3PutOptions`의 `ifMatch`/`ifNoneMatch: '*'`는 PutObject 또는 multipart 완료 시 AWS 조건부 쓰기를 사용합니다. 공통 StorageProvider에 조건부 쓰기 기능을 추가하지 않습니다. 다른 Provider에 같은 의미가 있다고 추론하지 마세요.
- upstream 실패는 안정적인 `STORAGE_S3_FAILED` Problem으로 공개하며 upstream 메시지·서명·credential은 public details에 넣지 않습니다. `extensions.details.cleanupFailed`는 multipart 정리가 실패했음을 나타냅니다. 원인은 비공개 `cause`로 보존합니다. 완료 응답 유실은 결과 미확정일 수 있으므로 무조건 전체 업로드를 재시도하지 마세요.

## Multipart와 취소

5 MiB 이하 bytes는 PutObject를 사용합니다. 큰 bytes와 모든 비어 있지 않은 stream은 AWS multipart를 사용합니다. 순차 업로드이며 part buffer는 5 MiB입니다(호출자가 제공한 chunk의 메모리는 별도). 최대 10,000 parts, 약 48.8 GiB까지 지원합니다. 빈 stream은 빈 객체로 저장합니다. 최종 part를 제외하면 5 MiB이며 part ETag와 순서를 완료 요청에 보존합니다. SDK가 재시도 가능한 bytes 요청을 처리하며 소모된 입력 stream 전체를 재생하지 않습니다.

실패·취소는 입력 stream 취소와 AbortMultipartUpload를 시작하고 정리를 기다린 뒤 반환합니다. 입력의 cancel()이 끝나지 않아도 원격 정리를 먼저 시작합니다. 이미 취소된 signal을 cleanup에 전달하지 않습니다. credential 갱신과 입력 취소를 포함한 전체 cleanup에는 독립적인 5초 예산을 적용하며 `cleanupTimeoutMs`로 설정할 수 있습니다. Lambda deadline에는 이 정리 예산을 남겨야 합니다. cleanup 실패는 정상 취소나 성공으로 숨기지 않습니다. 프로세스 강제 종료나 AWS 장애에 대비해 bucket에 incomplete multipart lifecycle expiration을 운영자가 설정해야 합니다. versioning, KMS, retention, IAM, 삭제 복구는 AWS native 정책을 따릅니다.

R2와 같은 SDK를 사용하더라도 AWS의 ACL·conditional write·multipart·ETag 의미를 R2에 복제하거나 보장하지 않습니다. Cloudinary 변환·upload intent도 S3 공통 기능으로 주장하지 않습니다.

## 인프라와 실행 근거

| Profile                  | 결정        | 제약                                                                                                                       |
| ------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| Kubernetes / Node Host   | conditional | Node 네트워크와 AWS credential chain 필요. IRSA trust와 prefix-scoped IAM은 운영자가 설정. 실제 cluster/STS/S3 인증 미검증 |
| AWS Lambda / Lambda Host | conditional | role 권한·네트워크·invocation 시간/메모리 필요. 업로드와 cleanup을 await하고 stream 소비 완료. 실제 AWS 배포 미검증        |
| Cloudflare Workers       | unsupported | Node SDK/네트워크 경로용 adapter. Worker isolate 지원을 주장하지 않음. R2 native binding은 별도 adapter                    |

[identity-contract.json](smoke/identity-contract.json)은 projected token·OIDC audience/subject·scope 제한 object policy·Lambda role reference·선택적 Secret reference를 보여주는 검토용 artifact입니다. 적용 가능한 IaC나 실제 권한 검사 결과가 아닙니다. placeholder를 환경에 맞게 검토하고 bucket/role/trust와 lifecycle을 별도로 배포해야 합니다. KMS 사용에는 별도 KMS 권한이 필요합니다. `s3:ListBucket`이 없는 경우 없는 객체에 대해서도 AWS가 403을 반환할 수 있으며 Provider는 이를 거짓 `false`로 바꾸지 않습니다.

```bash
pnpm --filter @croco/storage-s3 test
pnpm --filter @croco/storage-s3 typecheck
```

공통 conformance와 로컬 HTTP fixture는 실제 AWS SDK serialization, namespace/range/metadata, SigV4 독립 HMAC 검증, multipart 완료/실패/취소/cleanup 실패와 Node/Lambda Host 실행을 검증합니다. 테스트 credential은 fixture 전용이며 실제 AWS·IRSA·workload identity 인증이나 production certification을 증명하지 않습니다. 기존 R2·Cloudinary 테스트는 별도로 유지됩니다.

AWS 근거: [multipart 제한](https://docs.aws.amazon.com/AmazonS3/latest/userguide/qfacts.html), [conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html), [multipart 수명주기](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html).
