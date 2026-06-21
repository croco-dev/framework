import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PageDataContext,
  PageDataProvider,
  usePageData,
  usePageMeta,
} from "../libs/hooks/usePageData";

function renderWithPageData(value: {
  readonly data?: unknown;
  readonly description?: string;
  readonly title?: string;
  readonly urlOriginal?: string;
}): string {
  return renderToStaticMarkup(
    createElement(PageDataProvider, { value }, createElement(PageDataProbe)),
  );
}

function renderWithContext(children: ReactElement, value: object): string {
  return renderToStaticMarkup(createElement(PageDataContext.Provider, { value }, children));
}

function PageDataProbe(): ReactElement {
  const data = usePageData<{ readonly userId: number } | undefined>();

  return createElement(
    "span",
    { "data-user-id": data?.userId ?? "missing" },
    data ? `user:${data.userId}` : "missing",
  );
}

function TypedPageDataPage(): ReactElement {
  const data = usePageData<{
    readonly count: number;
    readonly message: string;
  }>();
  const meta = usePageMeta();

  return createElement(
    "main",
    null,
    createElement("h1", null, meta.title),
    createElement("p", null, `${data.message}:${data.count}:${meta.urlOriginal}`),
  );
}

function PageMetaProbe(): ReactElement {
  const meta = usePageMeta();

  return createElement(
    "span",
    {
      "data-description": meta.description,
      "data-title": meta.title,
      "data-url-original": meta.urlOriginal,
    },
    `${meta.title}:${meta.description}:${meta.urlOriginal}`,
  );
}

describe("usePageData", () => {
  it("renders typed page data through the provider", () => {
    const html = renderToStaticMarkup(
      createElement(
        PageDataProvider,
        {
          value: {
            data: { count: 3, message: "Hello from page data" },
            title: "Page Title",
            urlOriginal: "/dashboard",
          },
        },
        createElement(TypedPageDataPage),
      ),
    );

    expect(html).toContain("Page Title");
    expect(html).toContain("Hello from page data");
    expect(html).toContain("3");
    expect(html).toContain("/dashboard");
  });

  it("reads SSR page data from the provider during React rendering", () => {
    const html = renderWithPageData({ data: { userId: 1 } });

    expect(html).toContain('data-user-id="1"');
    expect(html).toContain("user:1");
  });

  it("returns undefined when no page data is present", () => {
    const html = renderWithContext(createElement(PageDataProbe), {});

    expect(html).toContain('data-user-id="missing"');
    expect(html).toContain("missing");
  });
});

describe("usePageMeta", () => {
  it("reads title, description, and original URL from the provider", () => {
    const html = renderToStaticMarkup(
      createElement(
        PageDataProvider,
        {
          value: {
            description: "Test Desc",
            title: "Test Title",
            urlOriginal: "/test",
          },
        },
        createElement(PageMetaProbe),
      ),
    );

    expect(html).toContain('data-title="Test Title"');
    expect(html).toContain('data-description="Test Desc"');
    expect(html).toContain('data-url-original="/test"');
    expect(html).toContain("Test Title:Test Desc:/test");
  });
});
