/**
 * Cloudinary 제공자 설정
 */
export type CloudinaryConfig = {
  /**
   * Cloudinary 클라우드 이름
   */
  cloudName: string;

  /**
   * Cloudinary API Key
   */
  apiKey: string;

  /**
   * Cloudinary API Secret
   */
  apiSecret: string;

  /**
   * HTTPS 사용 여부 (기본값: true)
   */
  secure?: boolean;
};

/**
 * Cloudinary 업로드 옵션
 */
export type CloudinaryUploadOptions = {
  /**
   * 업로드할 폴더 경로
   */
  folder?: string;

  /**
   * 사용자 정의 public ID (key)
   */
  publicId?: string;

  /**
   * 리소스 타입
   */
  resourceType?: 'image' | 'video' | 'raw';

  /**
   * 태그 목록
   */
  tags?: string[];

  /**
   * 컨텍스트 메타데이터 (key-value 쌍)
   */
  context?: Record<string, string>;

  /**
   * 업로드 시 적용할 변환 (eager transformations)
   */
  eager?: unknown[];
};

/**
 * Cloudinary 변환 옵션 (내부용)
 */
export type CloudinaryTransformOptions = {
  width?: number;
  height?: number;
  crop?: 'scale' | 'fit' | 'fill' | 'limit' | 'pad' | 'crop' | 'thumb';
  quality?: number;
  format?: string;
  dpr?: number;
};
