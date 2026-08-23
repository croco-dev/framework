import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  PageDataContext,
  PageDataProvider,
  PageDataUnavailableProblem,
  usePageData,
  usePageMeta,
  useParsedPageData,
  useRequiredPageData,
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

function captureRenderFailure(render: () => string): unknown {
  try {
    render();
  } catch (error) {
    return error;
  }

  return undefined;
}

function PageDataProbe(): ReactElement {
  const data = usePageData<{ readonly userId: number }>();

  return createElement(
    "span",
    { "data-user-id": data?.userId ?? "missing" },
    data ? `user:${data.userId}` : "missing",
  );
}

function TypedPageDataPage(): ReactElement {
  const data = useRequiredPageData<{
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

function RequiredPageDataProbe(): ReactElement {
  const data = useRequiredPageData<{ readonly userId: number }>();

  return createElement("span", null, `required:${data.userId}`);
}

function ParsedPageDataProbe({
  parser,
}: {
  readonly parser: { readonly parse: (input: unknown) => { readonly userId: string } };
}): ReactElement {
  const data = useParsedPageData(parser);

  return createElement("span", null, data ? `parsed:${data.userId}` : "missing");
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

  it("returns undefined when no provider is present", () => {
    const html = renderToStaticMarkup(createElement(PageDataProbe));

    expect(html).toContain('data-user-id="missing"');
    expect(html).toContain("missing");
  });

  it("returns required page data through the provider", () => {
    const html = renderWithContext(createElement(RequiredPageDataProbe), { data: { userId: 7 } });

    expect(html).toContain("required:7");
  });

  it("throws an actionable PageDataUnavailableProblem when the provider is missing", () => {
    const error = captureRenderFailure(() =>
      renderToStaticMarkup(createElement(RequiredPageDataProbe)),
    );

    expect(error).toBeInstanceOf(PageDataUnavailableProblem);
    expect(error).toMatchObject({
      code: "frontend-react/page-data-unavailable",
      detail:
        "Page data is unavailable. Wrap the component with PageDataProvider and pass a defined data value before calling useRequiredPageData().",
      status: 500,
    });
  });

  it("throws PageDataUnavailableProblem when the provider has no data", () => {
    const error = captureRenderFailure(() =>
      renderWithContext(createElement(RequiredPageDataProbe), { title: "Missing data" }),
    );

    expect(error).toBeInstanceOf(PageDataUnavailableProblem);
  });

  it("parses present page data before returning the parser output", () => {
    const parser = {
      parse: vi.fn((input: unknown) => ({
        userId: String((input as { readonly userId: number }).userId),
      })),
    };

    const html = renderWithContext(createElement(ParsedPageDataProbe, { parser }), {
      data: { userId: 9 },
    });

    expect(parser.parse).toHaveBeenCalledOnce();
    expect(parser.parse).toHaveBeenCalledWith({ userId: 9 });
    expect(html).toContain("parsed:9");
  });

  it("does not invoke the parser when page data is missing", () => {
    const parser = { parse: vi.fn(() => ({ userId: "unexpected" })) };

    const html = renderWithContext(createElement(ParsedPageDataProbe, { parser }), {});

    expect(parser.parse).not.toHaveBeenCalled();
    expect(html).toContain("missing");
  });

  it("propagates parser validation failures unchanged", () => {
    const validationFailure = new Error("invalid page payload");
    const parser = {
      parse: vi.fn(() => {
        throw validationFailure;
      }),
    };

    let thrown: unknown;
    try {
      renderWithContext(createElement(ParsedPageDataProbe, { parser }), { data: { userId: 9 } });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(validationFailure);
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
