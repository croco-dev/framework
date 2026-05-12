import { createContext, useContext } from 'react';

type PageDataContextValue = {
  data?: unknown;
  title?: string;
  description?: string;
  urlOriginal?: string;
};

export const PageDataContext = createContext<PageDataContextValue>({});

export const PageDataProvider = PageDataContext.Provider;

/**
 * SSR로 전달된 페이지 데이터에 타입 안전 접근을 제공한다.
 * App entry에서 PageDataProvider로 래핑 필요.
 * @returns 페이지 데이터 (타입 T로 캐스팅)
 */
export function usePageData<T = unknown>(): T {
  const ctx = useContext(PageDataContext);
  return ctx.data as T;
}

/**
 * 페이지 메타 정보에 접근한다.
 */
export function usePageMeta(): { title?: string; description?: string; urlOriginal?: string } {
  const ctx = useContext(PageDataContext);
  return {
    title: ctx.title,
    description: ctx.description,
    urlOriginal: ctx.urlOriginal,
  };
}
