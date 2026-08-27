export type StorageStream = ReadableStream<Uint8Array>;

export type StorageBody = Uint8Array | StorageStream;

/**
 * 파일 업로드 옵션
 */
export type PutOptions = {
  /**
   * Content-Type (MIME type)
   */
  contentType?: string;

  /**
   * Cache-Control 헤더
   */
  cacheControl?: string;

  /**
   * 공개 액세스 여부
   */
  isPublic?: boolean;

  /**
   * 메타데이터
   */
  metadata?: Record<string, string>;
};

/**
 * 서명된 URL 생성 옵션
 */
export type SignedUrlOptions = {
  /**
   * URL 만료 시간 (초 단위). 1초 이상 604,800초(7일) 이하의 안전한 정수여야 합니다.
   */
  expiresIn: number;
};

/**
 * 객체 메타데이터
 */
export type ObjectMetadata = {
  /**
   * 객체 크기 (bytes)
   */
  size: number;

  /**
   * Content-Type
   */
  contentType?: string;

  /**
   * 마지막 수정 시간
   */
  lastModified: Date;

  /**
   * ETag
   */
  etag?: string;

  /**
   * 사용자 정의 메타데이터
   */
  metadata?: Record<string, string>;
};

/**
 * 이미지 변환 옵션
 */
export type TransformOptions = {
  /**
   * 대상 너비 (px)
   */
  width?: number;

  /**
   * 대상 높이 (px)
   */
  height?: number;

  /**
   * 출력 형식
   */
  format?: "webp" | "avif" | "jpg" | "png" | "auto";

  /**
   * 리사이징 모드
   * - cover: 비율 유지하면서 채우기 (자르기)
   * - contain: 비율 유지하면서 맞추기 (여백)
   * - fill: 비율 무시하고 채우기
   * - inside: 비율 유지, 지정 크기 내에 맞춤
   * - outside: 비율 유지, 지정 크기覆盖
   */
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";

  /**
   * 품질 (1-100)
   */
  quality?: number;

  /**
   * Device Pixel Ratio (1-3)
   */
  dpr?: number;
};

/**
 * 업로드 의도 (클라이언트 직접 업로드용)
 */
export type UploadIntent = {
  /**
   * 업로드 URL
   */
  uploadUrl: string;

  /**
   * 업로드 후 public URL
   */
  publicUrl: string;

  /**
   * 업로드에 필요한 추가 필드 (multipart/form-data)
   */
  fields?: Record<string, string>;

  /**
   * 만료 시간
   */
  expiresAt: Date;
};

/**
 * 스토리지 제공자 인터페이스
 *
 * 원시 파일 저장소(S3, Blob Storage 등)를 위한 추상화 계층입니다.
 */
export type StorageProvider = {
  /**
   * 파일 업로드
   *
   * @param key - 파일 식별자
   * @param data - 파일 데이터 또는 Web ReadableStream
   * @param options - 업로드 옵션
   */
  put(key: string, data: StorageBody, options?: PutOptions): Promise<void>;

  /**
   * 파일 다운로드
   *
   * @param key - 파일 식별자
   * @returns 파일 바이트
   * @throws FileNotFoundProblem - 파일이 존재하지 않을 때
   */
  get(key: string): Promise<Uint8Array>;

  /**
   * 파일 스트림 다운로드
   *
   * @param key - 파일 식별자
   * @returns Web 읽기 가능 스트림
   * @throws FileNotFoundProblem - 파일이 존재하지 않을 때
   */
  getStream(key: string): Promise<StorageStream>;

  /**
   * 파일 삭제
   *
   * @param key - 파일 식별자
   */
  delete(key: string): Promise<void>;

  /**
   * 파일 존재 여부 확인
   *
   * @param key - 파일 식별자
   */
  exists(key: string): Promise<boolean>;

  /**
   * 공개 URL 반환
   *
   * @param key - 파일 식별자
   * @returns 공개 액세스 가능한 URL
   */
  getPublicUrl(key: string): string;

  /**
   * 서명된 URL 반환 (임시 액세스)
   *
   * @param key - 파일 식별자
   * @param options - 만료 시간 등 옵션
   * @returns 서명된 URL
   */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>;

  /**
   * 객체 메타데이터 조회
   *
   * @param key - 파일 식별자
   * @returns 객체 메타데이터
   * @throws FileNotFoundProblem - 파일이 존재하지 않을 때
   */
  getMetadata(key: string): Promise<ObjectMetadata>;
};

/**
 * 이미지 처리 제공자 인터페이스
 *
 * CDN 기반 이미지 변환을 위한 추상화 계층입니다.
 * Cloudflare Images, Cloudinary, imgix 등을 지원합니다.
 */
export type ImageProvider = {
  /**
   * 변환된 이미지 URL 반환
   *
   * CDN에서 실시간으로 이미지를 변환하고 반환합니다.
   *
   * @param key - 원본 이미지 식별자
   * @param options - 변환 옵션
   * @returns 변환된 이미지의 공개 URL
   */
  getTransformUrl(key: string, options: TransformOptions): string;

  /**
   * 클라이언트 직접 업로드를 위한 의도 생성 (선택)
   *
   * @param key - 업로드할 파일 식별자
   * @returns 업로드 의도 정보
   */
  getUploadIntent?(key: string, options?: { ttlInSeconds?: number }): Promise<UploadIntent>;
};
