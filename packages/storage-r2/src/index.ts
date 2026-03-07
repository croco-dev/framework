/**
 * Cloudflare R2 기반 스토리지 제공자 구현체입니다.
 */

export { MissingR2ConfigProblem } from './libs/problems/MissingR2ConfigProblem';
export { R2StorageProvider } from './libs/R2StorageProvider';

/**
 * R2 옵션을 DI 컨테이너에 등록할 때 사용하는 토큰입니다.
 */
export { R2_OPTIONS } from './libs/tokens';

/**
 * R2 제공자 구성에 필요한 공개 옵션 타입입니다.
 */
export type { R2Options } from './libs/types';
