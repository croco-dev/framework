import { act, createElement, type FunctionComponent, type ReactNode, useState } from 'react';
import { describe, expect, it } from 'vitest';

import { PageDataContext, PageDataProvider, usePageData, usePageMeta } from '../libs/hooks/usePageData';

// Simple renderHook without @testing-library/react
interface RenderHookOptions {
  wrapper?: FunctionComponent<{ children: ReactNode }>;
}

function renderHook<T>(hook: () => T, options?: RenderHookOptions) {
  let result: T | undefined;

  function TestComponent() {
    result = hook();
    return null;
  }

  if (options?.wrapper) {
    const WrapperComponent = options.wrapper;
    act(() => {
      createElement(WrapperComponent, { children: createElement(TestComponent) });
    });
  } else {
    act(() => {
      createElement(TestComponent);
    });
  }

  return {
    result: {
      get current() {
        return result as T;
      },
    },
  };
}

describe('usePageData', () => {
  it('Context에서 data를 가져온다', () => {
    const wrapper: FunctionComponent<{ children: ReactNode }> = ({ children }) =>
      createElement(PageDataProvider, { value: { data: { userId: 1 } } }, children);

    const { result } = renderHook(() => usePageData<{ userId: number }>(), { wrapper });

    expect(result.current.userId).toBe(1);
  });

  it('data가 없으면 undefined 반환', () => {
    const wrapper: FunctionComponent<{ children: ReactNode }> = ({ children }) =>
      createElement(PageDataContext.Provider, { value: {} }, children);

    const { result } = renderHook(() => usePageData(), { wrapper });

    expect(result.current).toBeUndefined();
  });
});

describe('usePageMeta', () => {
  it('title과 description을 반환한다', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PageDataProvider value={{ title: 'Test Title', description: 'Test Desc', urlOriginal: '/test' }}>
        {children}
      </PageDataProvider>
    );
    const { result } = renderHook(() => usePageMeta(), { wrapper });

    expect(result.current.title).toBe('Test Title');
    expect(result.current.description).toBe('Test Desc');
    expect(result.current.urlOriginal).toBe('/test');
  });
});
