import { createContext, useContext } from "react";

type PageDataContextValue = {
  data?: unknown;
  title?: string;
  description?: string;
  urlOriginal?: string;
};

/**
 * Internal React context that carries SSR page data and page metadata from the
 * generated entrypoint to Croco page hooks.
 *
 * App code normally wraps the root component with `PageDataProvider` instead of
 * reading this context directly. Advanced integrations can provide the same
 * shape when they bridge a custom renderer into `usePageData()` or
 * `usePageMeta()`.
 */
export const PageDataContext = createContext<PageDataContextValue>({});

/**
 * React provider for the Croco page data pattern.
 *
 * Place this provider at the browser hydration or SSR entrypoint so descendants
 * can call `usePageData<T>()` for route data and `usePageMeta()` for title,
 * description, and original URL metadata.
 *
 * @example
 * ```tsx
 * <PageDataProvider value={{ data: { message: "ready" }, title: "Home" }}>
 *   <Page />
 * </PageDataProvider>
 * ```
 */
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
