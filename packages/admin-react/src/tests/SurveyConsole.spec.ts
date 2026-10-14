import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SurveyResults } from "../libs/SurveyConsole";
describe("SurveyResults", () => {
  it("does not render unavailable collection as zero responses", () => {
    const error = renderToStaticMarkup(
      h(SurveyResults, {
        state: { kind: "error", message: "Storage unavailable" },
        onDenominatorChange: () => undefined,
      }),
    );
    expect(error).toContain("Storage unavailable");
    expect(error).not.toContain("submitted");
  });
  it("keeps human classification separate from escaped raw text and preserves zero-denominator unavailability", () => {
    const markup = renderToStaticMarkup(
      h(SurveyResults, {
        state: {
          kind: "ready",
          data: {
            invitations: 0,
            exposures: 0,
            dismissed: 0,
            submitted: 0,
            unexposed: 0,
            unanswered: 0,
            denominator: 0,
            denominatorKind: "exposure",
            responseRate: null,
          },
          responses: [
            {
              id: "i",
              invitationId: "i",
              familyId: "family",
              revision: 2,
              submittedAt: "2026-01-01T00:00:00Z",
              idempotencyKey: "a",
              answers: { text: "<script>raw</script>" },
              classification: "Human category",
            },
          ],
        },
        onDenominatorChange: () => undefined,
      }),
    );
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("Actual exposures");
    expect(markup).toContain("&lt;script&gt;raw");
    expect(markup).toContain("Human classification: Human category");
    expect(markup).not.toContain("<script>");
  });
});
