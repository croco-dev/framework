/**
 * Cloudflare Images 제공자 옵션
 */
export type CloudflareImagesOptions = {
  /**
   * Cloudflare Account ID
   */
  accountId: string;

  /**
   * Cloudflare API Token (Images API 권한 필요)
   */
  apiToken: string;

  signingKey?: string;

  /**
   * Cloudflare Account Hash (공개 URL용)
   */
  accountHash: string;

  /**
   * 커스텀 도메인 (선택)
   * 설정된 경우 커스텀 도메인을 통해 이미지 제공
   */
  customDomain?: string;

  /**
   * 기본 변형 (variant)
   * 기본값: 'public'
   */
  defaultVariant?: string;
};

/**
 * Cloudflare Images API 업로드 응답
 */
export type CloudflareUploadResponse = {
  /**
   * 업로드 결과
   */
  result: {
    /**
     * 이미지 ID (고유 식별자)
     */
    id: string;

    /**
     * 원본 파일명
     */
    filename: string;

    /**
     * 업로드 시간
     */
    uploaded: string;

    /**
     * 서명된 URL 필요 여부
     */
    requireSignedURLs: boolean;

    /**
     * 가능한 변형(variants) URL 목록
     */
    variants: string[];
  };

  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 에러 목록
   */
  errors: unknown[];

  /**
   * 메시지 목록
   */
  messages: unknown[];
};

/**
 * Cloudflare Images API 이미지 상세 응답
 */
export type CloudflareImageDetails = {
  /**
   * 이미지 상세 정보
   */
  result: {
    /**
     * 이미지 ID
     */
    id: string;

    /**
     * 원본 파일명
     */
    filename: string;

    /**
     * 업로드 시간
     */
    uploaded: string;

    /**
     * 서명된 URL 필요 여부
     */
    requireSignedURLs: boolean;

    /**
     * 가능한 변성(variants) URL 목록
     */
    variants: string[];

    /**
     * 이미지 크기 (bytes)
     */
    size?: number;
  };

  /**
   * 성공 여부
   */
  success: boolean;

  /**
   * 에러 목록
   */
  errors: unknown[];

  /**
   * 메시지 목록
   */
  messages: unknown[];
};

/**
 * Cloudflare 변환 옵션
 */
export type CloudflareTransformOptions = {
  /**
   * 너비 (px)
   */
  width?: number;

  /**
   * 높이 (px)
   */
  height?: number;

  /**
   * 맞춤 방식
   * - scale-down: 비율 유지하며 지정 크기 내에서 축소
   * - contain: 비율 유지하며 지정 크기에 맞춤 (여백 있음)
   * - cover: 비율 유지하며 지정 크기 채움 (자름)
   * - fill: 비율 무시하고 지정 크기 채움
   */
  fit?: 'scale-down' | 'contain' | 'cover' | 'fill';

  /**
   * 품질 (1-100)
   */
  quality?: number;

  /**
   * 출력 형식
   */
  format?: 'webp' | 'avif' | 'jpeg' | 'png' | 'gif';

  /**
   * Device Pixel Ratio
   */
  dpr?: number;

  /**
   * 선명화 (1-10)
   */
  sharpen?: number;

  /**
   * 블러 (1-1000)
   */
  blur?: number;

  /**
   * 회전 (0-359)
   */
  rotate?: number;

  /**
   * 그레이스케일 변환
   */
  grayscale?: boolean;

  /**
   * 반전
   */
  invert?: boolean;
};
