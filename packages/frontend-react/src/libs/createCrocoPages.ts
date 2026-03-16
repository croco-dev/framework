import type { CrocoPageContext } from './types';

/**
 * Croco 앱에서 Vike 페이지 설정의 기본값을 제공한다.
 * 사용자는 각 페이지의 +config.ts에서 이 함수의 반환값을 spread하여 사용한다.
 */
export function createCrocoPageConfig(options?: { ssr?: boolean }) {
  return {
    ssr: options?.ssr ?? true,
    passToClient: ['data', 'title', 'description'] as const,
  };
}
