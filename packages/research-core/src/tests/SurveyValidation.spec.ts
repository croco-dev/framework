import { describe, expect, it } from "vitest";
import {
  validateSurveyDefinition,
  validateSurveyAnswers,
  surveyCsvCell,
  SurveyInvalidProblem,
} from "../index";
import type { SurveyDefinition, SurveyAnswers } from "../index";

const definition: SurveyDefinition = {
  id: "satisfaction",
  version: "v1",
  title: "How was your first report?",
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: "2027-01-01T00:00:00Z",
  eligibility: "everyone",
  trigger: "report.saved",
  frequencyPolicy: { maxInvitations: 2, windowMs: 86400000 },
  allowEdits: true,
  retentionMs: 86400000,
  questions: [
    {
      id: "choice",
      title: "Result",
      kind: "single",
      required: true,
      options: [
        { id: "useful", label: "Useful" },
        { id: "unclear", label: "Unclear" },
      ],
    },
    {
      id: "multi",
      title: "Features",
      kind: "multi",
      required: false,
      options: [
        { id: "export", label: "Export" },
        { id: "chart", label: "Chart" },
      ],
    },
    { id: "score", title: "Score", kind: "scale", required: true, min: 1, max: 5 },
    { id: "text", title: "Comment", kind: "text", required: false, maxLength: 30 },
  ],
};
describe("survey validation", () => {
  const optionalDefinition: SurveyDefinition = {
    ...definition,
    questions: definition.questions.map((question) => ({ ...question, required: false })),
  };
  it.each<SurveyAnswers>([
    { choice: [] },
    { choice: "" },
    { multi: "" },
    { score: [] },
    { score: "" },
    { text: [] },
  ])("rejects wrong empty representations for optional answers %j", (answers) => {
    expect(() => validateSurveyAnswers(optionalDefinition, answers)).toThrow(SurveyInvalidProblem);
  });
  it.each<SurveyAnswers>([{}, { text: "", multi: [] }])(
    "accepts typed optional emptiness %j",
    (answers) => {
      expect(() => validateSurveyAnswers(optionalDefinition, answers)).not.toThrow();
    },
  );
  it.each<SurveyAnswers>([
    { choice: "useful", score: 2, multi: [], text: "Feedback" },
    { choice: "useful", score: 2, multi: ["chart"], text: "" },
  ])("still rejects correctly typed empty required answers %j", (answers) => {
    const requiredDefinition: SurveyDefinition = {
      ...definition,
      questions: definition.questions.map((question) => ({ ...question, required: true })),
    };
    expect(() => validateSurveyAnswers(requiredDefinition, answers)).toThrow(SurveyInvalidProblem);
  });
  it("accepts asymmetric answers and exact text/scale boundaries", () => {
    expect(() =>
      validateSurveyAnswers(definition, {
        choice: "unclear",
        multi: ["export"],
        score: 5,
        text: "x".repeat(30),
      }),
    ).not.toThrow();
  });
  it.each<SurveyAnswers>([
    { choice: "old", score: 3 },
    { choice: "useful", score: 0 },
    { choice: "useful", score: 6 },
    { choice: "useful", score: 2.5 },
    { choice: "useful", score: 3, text: "x".repeat(31) },
    { choice: "useful", score: 3, multi: ["export", "export"] },
    { choice: "useful", score: 3, multi: ["missing"] },
    { choice: "useful", score: 3, unknown: "x" },
    { score: 3 },
  ])("rejects invalid answers %j", (answers) => {
    expect(() => validateSurveyAnswers(definition, answers)).toThrow(SurveyInvalidProblem);
  });
  it("does not interpret v1 choices with v2 options", () => {
    const v2 = {
      ...definition,
      version: "v2",
      questions: [
        {
          ...definition.questions[0],
          kind: "single" as const,
          options: [
            { id: "yes", label: "Yes" },
            { id: "no", label: "No" },
          ],
        },
      ],
    };
    expect(() => validateSurveyAnswers(v2, { choice: "unclear" })).toThrow();
    expect(() => validateSurveyAnswers(definition, { choice: "unclear", score: 2 })).not.toThrow();
  });
  it("rejects nonfinite definitions and duplicate identities", () => {
    expect(() =>
      validateSurveyDefinition({
        ...definition,
        frequencyPolicy: { maxInvitations: 1, windowMs: NaN },
      }),
    ).toThrow();
    expect(() =>
      validateSurveyDefinition({
        ...definition,
        questions: [definition.questions[0]!, definition.questions[0]!],
      }),
    ).toThrow();
  });
  it("escapes quotes and guards spreadsheet formulas including leading whitespace", () => {
    expect(surveyCsvCell(' =HYPERLINK("url")')).toBe('"\' =HYPERLINK(""url"")"');
    expect(surveyCsvCell("normal, text")).toBe('"normal, text"');
    expect(surveyCsvCell("\tcmd")).toBe('"\'\tcmd"');
  });
});
