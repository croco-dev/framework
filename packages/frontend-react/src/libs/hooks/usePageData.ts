import { usePageContext } from 'vike-react/usePageContext';

/**
 * Vike의 usePageContext를 래핑하여 data에 타입 안전 접근을 제공한다.
 * @returns 페이지 데이터 (타입 T로 캐스팅)
 */
export function usePageData<T = unknown>(): T {
  const pageContext = usePageContext();
  return pageContext.data as T;
}
