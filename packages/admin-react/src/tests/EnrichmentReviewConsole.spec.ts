import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EnrichmentReviewConsole } from "../libs/EnrichmentReviewConsole";
import type { EnrichmentPage } from "@croco/analytics-core/enrichment";

describe("EnrichmentReviewConsole", () => {
  it.each([
    ["purchase", "purchase", "available", undefined],
    ["retired-label", "support", "available", undefined],
    [undefined, "support", "available", undefined],
    [undefined, "support", "available", "running"],
    [undefined, "support", "raw-expired", "running"],
  ] as const)(
    "renders review %s, selected %s, availability %s, candidate %s",
    (reviewLabel, selectedLabel, availability, candidateState) => {
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
            original: availability === "raw-expired" ? null : "Original input",
            availability,
            candidates:
              candidateState === "running"
                ? [
                    {
                      receiptId: "stopped-worker",
                      cacheKey: "old-operator",
                      definitionId: "intent",
                      definitionVersion: "v1",
                      normalizationVersion: "n1",
                      catalogHash: "catalog",
                      promptHash: "prompt",
                      modelRef: "fixture",
                      method: "model",
                      state: "running",
                      attempt: 1,
                      usage: { kind: "unknown" },
                      delivery: "pending",
                      occurredAt: "2026-01-01T00:00:00Z",
                      leaseUntil: 0,
                    },
                  ]
                : [],
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
      if (candidateState === "running") {
        expect(html).toContain("Acknowledge stopped worker");
        expect(html).toContain("lease");
        expect(html).toMatch(/disabled=""[^>]*>Acknowledge stopped worker/);
      }
    },
  );
});
