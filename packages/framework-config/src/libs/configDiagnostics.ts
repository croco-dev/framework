type ValidationIssue = {
  readonly message?: string;
  readonly code?: unknown;
  readonly expected?: unknown;
  readonly format?: unknown;
};

function safeIssueMessage(issue: ValidationIssue): string {
  switch (issue.code) {
    case "invalid_type":
      return /^(string|number|boolean|object|array|null|undefined|bigint|date|symbol|function)$/.test(
        typeof issue.expected === "string" ? issue.expected : "",
      )
        ? `Expected ${issue.expected}`
        : "Invalid type";
    case "invalid_format":
      return issue.format === "url" ? "Invalid URL" : "Invalid format";
    case "invalid_value":
      return "Invalid option";
    case "too_small":
      return "Value is too small";
    case "too_big":
      return "Value is too large";
    default:
      return "Invalid value";
  }
}

export function configDiagnostic(path: string, issue: ValidationIssue, missing: boolean): string {
  if (missing) return `${path}: Missing required`;
  const code =
    typeof issue.code === "string" &&
    [
      "invalid_type",
      "invalid_format",
      "invalid_value",
      "too_small",
      "too_big",
      "not_multiple_of",
      "invalid_union",
      "invalid_key",
      "invalid_element",
      "unrecognized_keys",
      "custom",
    ].includes(issue.code)
      ? issue.code
      : "invalid_value";
  return `${path}: ${code}: ${safeIssueMessage(issue)}`;
}
