/**
 * Cloudflare R2 스토리지 제공자 설정 옵션
 */
export type R2Options = {
  /**
   * Cloudflare Account ID
   */
  accountId: string;

  /**
   * R2 Access Key ID
   */
  accessKeyId: string;

  /**
   * R2 Secret Access Key
   */
  secretAccessKey: string;

  /**
   * R2 버킷 이름
   */
  bucket: string;

  /**
   * 공개 URL 기본 경로 (선택)
   *
   * Custom domain을 사용하는 경우 설정합니다.
   * 예: 'https://cdn.example.com'
   *
   * 설정하지 않으면 R2의 기본 퍼블릭 URL을 사용합니다:
   * `https://{bucket}.{accountId}.r2.dev`
   */
  publicUrlBase?: string;
};
