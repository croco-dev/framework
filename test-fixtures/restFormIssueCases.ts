import { readFileSync } from "node:fs";

type RestFormIssueCase = {
  readonly name: string;
  readonly fieldNames: readonly string[];
  readonly extensions: Record<string, unknown>;
  readonly expected: Record<string, readonly string[]>;
};

export const restFormIssueCases = JSON.parse(
  readFileSync(new URL("./rest-form-issue-cases.json", import.meta.url), "utf8"),
) as readonly RestFormIssueCase[];
