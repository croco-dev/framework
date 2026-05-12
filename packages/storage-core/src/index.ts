/**
 * 스토리지 제공자 구현을 위한 기본 추상 클래스입니다.
 */
export { BaseStorageProvider } from "./libs/BaseStorageProvider";

/**
 * 테스트/로컬 개발용 인메모리 스토리지 제공자 구현체입니다.
 */
export { InMemoryStorageProvider } from "./libs/InMemoryStorageProvider";

/**
 * 파일 삭제에 실패했을 때 발생하는 Problem 타입입니다.
 */
export { DeleteFailedProblem } from "./libs/problems/DeleteFailedProblem";

/**
 * 요청한 파일을 찾을 수 없을 때 발생하는 Problem 타입입니다.
 */
export { FileNotFoundProblem } from "./libs/problems/FileNotFoundProblem";

/**
 * 유효하지 않은 스토리지 키가 전달되었을 때 발생하는 Problem 타입입니다.
 */
export { InvalidKeyProblem } from "./libs/problems/InvalidKeyProblem";

/**
 * 스토리지 도메인 공통 상위 Problem 타입입니다.
 */
export { StorageProblem } from "./libs/problems/StorageProblem";

/**
 * 파일 업로드에 실패했을 때 발생하는 Problem 타입입니다.
 */
export { UploadFailedProblem } from "./libs/problems/UploadFailedProblem";

/**
 * 스토리지/이미지 제공자 계약과 업로드·변환 관련 공개 타입들입니다.
 */
export type {
  ImageProvider,
  ObjectMetadata,
  PutOptions,
  SignedUrlOptions,
  StorageProvider,
  TransformOptions,
  UploadIntent,
} from "./libs/types";
