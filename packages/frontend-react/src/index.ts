/**
 * @croco/frontend-react
 *
 * React 앱에서 Croco의 SSR 기능을 사용하기 위한 유틸리티 패키지
 *
 * 이 패키지는 React 앱에서 Vike와 함께 Croco의 SSR 데이터 전송 기능을 사용하기 위한
 * 훅과 설정 함수를 제공합니다.
 */

export { createCrocoPageConfig } from './libs/createCrocoPages';
export { usePageData } from './libs/hooks/usePageData';
export type { CrocoDataFn, CrocoPageContext } from './libs/types';
