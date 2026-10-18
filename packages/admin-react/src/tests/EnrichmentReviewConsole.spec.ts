import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EnrichmentReviewConsole } from "../libs/EnrichmentReviewConsole";
import type { EnrichmentPage } from "@croco/analytics-core/enrichment";

describe("EnrichmentReviewConsole", () => {
  it.each([
    ["purchase", "purchase"],
    ["retired-label", "support"],
    [undefined, "support"],
  ])("selects the current allowed review label for %s", (reviewLabel, selectedLabel) => {
    const page: EnrichmentPage = {
      runId: "synthetic",
      revision: 1,
      requests: 0,
      reservedTokens: 0,
      nextOffset: null,
      status: "review-required",
      items: [
        {
          itemId: "a",
          inputRevision: "r1",
          sourceRef: "synthetic-a",
          original: "Original input",
          availability: "available",
          candidates: [],
          reviewHistory: [],
          ...(reviewLabel === undefined
            ? {}
            : {
                review: {
                  labelId: reviewLabel,
                  actor: "reviewer",
                  reason: "Verified source",
                  evidence: "Original evidence",
                  revision: 1,
                  candidateRef: null,
                  definitionId: "intent",
                  definitionVersion: "v1",
                },
              }),
        },
      ],
    };
    const html = renderToStaticMarkup(
      createElement(EnrichmentReviewConsole, {
        scopeKey: "synthetic-scope",
        state: { status: "ready", page },
        definitions: [
          {
            version: "v1",
            labels: [
              { id: "support", label: "Support" },
              { id: "purchase", label: "Purchase" },
            ],
          },
        ],
        canReview: true,
        canClassify: true,
        canExport: true,
        onClassify: vi.fn(async () => page),
        onReview: vi.fn(async () => page),
        onRetry: vi.fn(async () => page),
        onLoad: vi.fn(async () => page),
        onSettle: vi.fn(async () => page),
        onExport: vi.fn(async () => []),
      }),
    );
    expect(html).toContain(`<option value="${selectedLabel}" selected="">`);
  });
});
