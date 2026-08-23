import { createContext, useContext } from "react";

import { Problem, ProblemCategory } from "@croco/problems-core";

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
 * shape when they bridge a custom renderer into Croco page data hooks.
 */
export const PageDataContext = createContext<PageDataContextValue>({});

/**
 * React provider for the Croco page data pattern.
 *
 * Place this provider at the browser hydration or SSR entrypoint so descendants
 * can call the optional, required, or parsed page data hook for route data and
 * `usePageMeta()` for title, description, and original URL metadata.
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
 * Raised when required page data is read without a defined provider value.
 *
 * Wrap the component tree with `PageDataProvider` and pass its `data` field
 * before calling `useRequiredPageData()`.
 */
export class PageDataUnavailableProblem extends Problem {
  constructor() {
    super(
      "frontend-react/page-data-unavailable",
      ProblemCategory.InternalServerError,
      "Page data is unavailable. Wrap the component with PageDataProvider and pass a defined data value before calling useRequiredPageData().",
    );
  }
}

/**
 * SSR로 전달된 페이지 데이터에 선택적으로 접근한다.
 * App entry에서 PageDataProvider로 래핑 필요.
 *
 * 이 훅은 hydration payload를 검증하지 않는다. 런타임 검증이 필요하면
 * `useParsedPageData()`를 사용한다.
 *
 * @returns 페이지 데이터 또는 provider/data가 없을 때 undefined
 */
export function usePageData<T = unknown>(): T | undefined {
  const ctx = useContext(PageDataContext);
  return ctx.data as T | undefined;
}

/**
 * SSR로 전달된 필수 페이지 데이터에 접근한다.
 *
 * @throws `PageDataUnavailableProblem` when the provider has no defined data.
 * @returns 페이지 데이터 (타입 T로 캐스팅)
 */
export function useRequiredPageData<T = unknown>(): T {
  const ctx = useContext(PageDataContext);
  if (ctx.data === undefined) {
    throw new PageDataUnavailableProblem();
  }

  return ctx.data as T;
}

/**
 * SSR로 전달된 페이지 데이터를 parser로 검증한 뒤 반환한다.
 *
 * Parser는 data가 있을 때만 호출되며 parser가 던진 validation failure는 그대로 전파된다.
 *
 * @returns 검증된 페이지 데이터 또는 provider/data가 없을 때 undefined
 */
export function useParsedPageData<T>(parser: {
  readonly parse: (input: unknown) => T;
}): T | undefined {
  const ctx = useContext(PageDataContext);
  if (ctx.data === undefined) {
    return undefined;
  }

  return parser.parse(ctx.data);
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
