import { describe, expect, expectTypeOf, it } from "vitest";
import {
  assertProblemExhaustive,
  type CrocoProblemDetails,
  type CrocoProblemStatus,
  Problem,
  ProblemCategory,
  type TypedProblemDetails,
} from "../index";

class NotFoundProblem extends Problem {
  constructor(resource: string) {
    super(
      "RESOURCE_NOT_FOUND",
      ProblemCategory.NotFound,
      `The requested ${resource} could not be found`,
    );
  }
}

class ValidationProblem extends Problem {
  constructor(field: string) {
    super(
      "VALIDATION_FAILED",
      ProblemCategory.ValidationError,
      `Field '${field}' failed validation`,
    );
  }
}

class UnauthorizedProblem extends Problem {
  constructor() {
    super("UNAUTHORIZED", ProblemCategory.Unauthorized, "Authentication required");
  }
}

describe("Problem", () => {
  it("should extend Error", () => {
    const problem = new NotFoundProblem("User");

    expect(problem).toBeInstanceOf(Error);
    expect(problem).toBeInstanceOf(Problem);
  });

  it("should have correct message", () => {
    const problem = new NotFoundProblem("User");

    expect(problem.message).toBe("The requested User could not be found");
  });

  it("should have correct code", () => {
    const problem = new NotFoundProblem("User");

    expect(problem.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("should have correct category", () => {
    const problem = new NotFoundProblem("User");

    expect(problem.category).toBe(ProblemCategory.NotFound);
  });

  it("should have correct detail", () => {
    const problem = new NotFoundProblem("User");

    expect(problem.detail).toBe("The requested User could not be found");
  });

  it("should maintain prototype chain for instanceof checks", () => {
    const problem = new NotFoundProblem("Resource");

    expect(problem instanceof NotFoundProblem).toBe(true);
    expect(problem instanceof Problem).toBe(true);
    expect(problem instanceof Error).toBe(true);
  });

  it("should be throwable and catchable", () => {
    expect(() => {
      throw new NotFoundProblem("Item");
    }).toThrow(NotFoundProblem);

    expect(() => {
      throw new NotFoundProblem("Item");
    }).toThrow("The requested Item could not be found");
  });

  it("should expose typed Problem details and a never-based exhaustive helper", () => {
    const details: TypedProblemDetails<"RESOURCE_NOT_FOUND", 404> = {
      type: "about:blank",
      title: "Not Found",
      status: 404,
      code: "RESOURCE_NOT_FOUND",
    };

    expect(details.code).toBe("RESOURCE_NOT_FOUND");
    expect(() => assertProblemExhaustive({ code: "OTHER" } as never)).toThrow(
      "Unhandled Problem variant: OTHER",
    );
  });

  it("should preserve literal fixed statuses and widen only runtime-configurable codes", () => {
    const configuredDetails: CrocoProblemDetails<"transports-http/request-body-too-large"> = {
      type: "https://croco.dev/problems/transports-http/request-body-too-large",
      title: "Payload Too Large",
      status: 422,
      code: "transports-http/request-body-too-large",
    };

    expectTypeOf<
      CrocoProblemStatus<"transports-http/request-body-too-large">
    >().toEqualTypeOf<number>();
    expectTypeOf<
      CrocoProblemStatus<"transports-graphql/request-body-too-large">
    >().toEqualTypeOf<413>();
    expect(configuredDetails.status).toBe(422);
  });
});

describe("ProblemCategory", () => {
  it("should have BadRequest category", () => {
    expect(ProblemCategory.BadRequest).not.toBeUndefined();
  });

  it("should have Unauthorized category", () => {
    expect(ProblemCategory.Unauthorized).not.toBeUndefined();

    const problem = new UnauthorizedProblem();
    expect(problem.category).toBe(ProblemCategory.Unauthorized);
  });

  it("should have Forbidden category", () => {
    expect(ProblemCategory.Forbidden).not.toBeUndefined();
  });

  it("should have NotFound category", () => {
    expect(ProblemCategory.NotFound).not.toBeUndefined();
  });

  it("should have Conflict category", () => {
    expect(ProblemCategory.Conflict).not.toBeUndefined();
  });

  it("should have Gone category", () => {
    expect(ProblemCategory.Gone).not.toBeUndefined();
  });

  it("should have PayloadTooLarge category", () => {
    expect(ProblemCategory.PayloadTooLarge).not.toBeUndefined();
  });

  it("should have ValidationError category", () => {
    expect(ProblemCategory.ValidationError).not.toBeUndefined();

    const problem = new ValidationProblem("email");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
  });

  it("should have BusinessRuleViolation category", () => {
    expect(ProblemCategory.BusinessRuleViolation).not.toBeUndefined();
  });

  it("should have TooManyRequests category", () => {
    expect(ProblemCategory.TooManyRequests).not.toBeUndefined();
  });

  it("should have InternalServerError category", () => {
    expect(ProblemCategory.InternalServerError).not.toBeUndefined();
  });

  it("should have NotImplemented category", () => {
    expect(ProblemCategory.NotImplemented).not.toBeUndefined();
  });
});

describe("Problem with different categories", () => {
  it("should work with ValidationError category", () => {
    const problem = new ValidationProblem("email");

    expect(problem.code).toBe("VALIDATION_FAILED");
    expect(problem.category).toBe(ProblemCategory.ValidationError);
    expect(problem.detail).toBe("Field 'email' failed validation");
  });

  it("should work with Unauthorized category", () => {
    const problem = new UnauthorizedProblem();

    expect(problem.code).toBe("UNAUTHORIZED");
    expect(problem.category).toBe(ProblemCategory.Unauthorized);
    expect(problem.detail).toBe("Authentication required");
  });
});
