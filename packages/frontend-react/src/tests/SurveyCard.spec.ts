import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { SurveyCard } from "../libs/SurveyCard";
import type { SurveyDefinition } from "@croco/research-core";
const d: SurveyDefinition = {
  id: "survey",
  version: "v1",
  title: "<script>title</script>",
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: "2027-01-01T00:00:00Z",
  eligibility: "everyone",
  trigger: "saved",
  frequencyPolicy: { maxInvitations: 1, windowMs: 1000 },
  allowEdits: false,
  retentionMs: 1000,
  questions: [
    {
      id: "text",
      title: "<img src=x onerror=alert(1)>",
      kind: "text",
      required: false,
      maxLength: 40,
    },
  ],
};
describe("SurveyCard", () => {
  it("escapes customer-facing question copy and leaves optional skipping outside required answers", () => {
    const markup = renderToStaticMarkup(
      h(SurveyCard, {
        definition: d,
        identity: "i",
        onSubmit: async () => undefined,
        onDismiss: async () => undefined,
      }),
    );
    expect(markup).toContain("&lt;script&gt;");
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<script>");
    expect(markup).toContain('type="button"');
    expect(markup).toContain("Skip survey");
    expect(markup).toContain('maxlength="40"');
  });
});
