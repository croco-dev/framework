import { describe, expect, it } from "vitest";
import {
  OPERATOR_ONLY_PROBLEM_DETAIL,
  Problem,
  ProblemCategory,
  createProblemResponseDetail,
  createProblemResponseExtensions,
  resolveProblemCodeRedactionPolicy,
  resolveProblemDetailsResponseRedactionPolicy,
} from "../index";

describe("ProblemResponseRedaction", () => {
  it("resolves generated codes before category fallback", () => {
    expect(resolveProblemCodeRedactionPolicy("ACCESS_DENIED", ProblemCategory.Forbidden)).toBe(
      "safe-message",
    );
    expect(resolveProblemCodeRedactionPolicy("unknown/not-found", ProblemCategory.NotFound)).toBe(
      "public",
    );
    expect(
      resolveProblemCodeRedactionPolicy("unknown/internal", ProblemCategory.InternalServerError),
    ).toBe("operator-only");
  });

  it("keeps only public-safe extensions for non-operator responses", () => {
    expect(
      createProblemResponseExtensions(
        {
          field: "email",
          reason: "tenant mismatch",
          requestId: "request-secret",
          diagnostics: "provider-secret",
          code: "override-attempt",
        },
        "safe-message",
      ),
    ).toEqual({
      field: "email",
      reason: "tenant mismatch",
    });
  });

  it("uses an opaque detail and no extensions for operator-only responses", () => {
    expect(createProblemResponseDetail("database password leaked", "operator-only")).toBe(
      OPERATOR_ONLY_PROBLEM_DETAIL,
    );
    expect(
      createProblemResponseExtensions(
        {
          field: "email",
          reason: "database password leaked",
        },
        "operator-only",
      ),
    ).toEqual({});
  });

  it("does not inherit public redaction across codes that only share a custom status", () => {
    class CustomStatusBodyTooLargeProblem extends Problem {
      constructor() {
        super(
          "transports-http/request-body-too-large",
          ProblemCategory.PayloadTooLarge,
          "sensitive body details",
        );
      }

      override get status(): number {
        return 500;
      }
    }

    const sourceProblem = new CustomStatusBodyTooLargeProblem();

    expect(
      resolveProblemDetailsResponseRedactionPolicy(
        {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          code: "filter/unregistered-code",
          detail: "sensitive body details",
        },
        sourceProblem,
      ),
    ).toBe("operator-only");
    expect(
      resolveProblemDetailsResponseRedactionPolicy(
        {
          type: "about:blank",
          title: "Payload Too Large",
          status: 500,
          code: sourceProblem.code,
          detail: "public body details",
        },
        sourceProblem,
      ),
    ).toBe("public");
  });
});
