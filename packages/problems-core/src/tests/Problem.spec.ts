import { runInNewContext } from "node:vm";
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

class ExtensionProblem extends Problem {
  constructor(extensions: Record<string, unknown>) {
    super("EXTENSION_FAILURE", ProblemCategory.BadRequest, "Extension failure", { extensions });
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

  it.each(["type", "title", "status", "detail", "instance", "code"])(
    'should reject the reserved extension key "%s" before serialization',
    (key) => {
      expect(() => new ExtensionProblem({ [key]: "override" })).toThrow(
        expect.objectContaining({ code: "problems-core/invalid-extensions" }),
      );
    },
  );

  it("should retain nested JSON-safe extensions without sharing mutable input", () => {
    const extensions = {
      errors: [{ field: "email", messages: ["invalid", null] }],
      retryable: false,
    };
    const problem = new ExtensionProblem(extensions);

    extensions.errors[0].field = "mutated";
    expect(Reflect.set(problem.extensions?.errors as object, "unsafe", BigInt(1))).toBe(false);

    expect(problem.toJSON()).toEqual({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "Extension failure",
      code: "EXTENSION_FAILURE",
      errors: [{ field: "email", messages: ["invalid", null] }],
      retryable: false,
    });
    expect(JSON.parse(JSON.stringify(problem))).toEqual(problem.toJSON());
  });

  it("should accept plain extension objects created in another realm", () => {
    const extensions = runInNewContext(
      '({ source: "generated-client", nested: { safe: true } })',
    ) as unknown as Record<string, unknown>;

    expect(new ExtensionProblem(extensions).toJSON()).toMatchObject({
      nested: { safe: true },
      source: "generated-client",
    });
  });

  it.each([
    [
      "host Object constructor",
      () => {
        const prototype = Object.create(null) as Record<string, unknown>;
        Object.defineProperty(prototype, "constructor", { value: Object });
        return Object.assign(Object.create(prototype) as Record<string, unknown>, { safe: true });
      },
    ],
    [
      "fake Object constructor",
      () => {
        const prototype = Object.create(null) as Record<string, unknown>;
        const FakeObject = function Object() {};
        FakeObject.prototype = prototype;
        Object.defineProperty(prototype, "constructor", { value: FakeObject });
        return Object.assign(Object.create(prototype) as Record<string, unknown>, { safe: true });
      },
    ],
  ])("should reject custom prototypes with a spoofed %s", (_case, createExtensions) => {
    expect(() => new ExtensionProblem(createExtensions())).toThrow(
      expect.objectContaining({ code: "problems-core/invalid-extensions" }),
    );
  });

  it("should preserve a __proto__ extension as JSON data without mutating the result prototype", () => {
    const extensions = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
    const details = new ExtensionProblem(extensions).toJSON();

    expect(Object.getPrototypeOf(details)).toBe(Object.prototype);
    expect(Object.hasOwn(details, "__proto__")).toBe(true);
    expect(details.__proto__).toEqual({ polluted: true });
    expect(JSON.parse(JSON.stringify(details))).toEqual(details);
  });

  it("should reject reserved keys introduced after construction", () => {
    const problem = new ExtensionProblem({ safe: true });
    Object.defineProperty(problem, "extensions", {
      configurable: true,
      enumerable: true,
      value: { status: 299 },
      writable: true,
    });

    expect(() => problem.toJSON()).toThrow(
      expect.objectContaining({ code: "problems-core/invalid-extensions" }),
    );
  });

  it("should reject an extension accessor introduced after construction without invoking it", () => {
    let getterCalls = 0;
    const problem = new ExtensionProblem({ safe: true });
    Object.defineProperty(problem, "extensions", {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls++;
        throw new Error("getter must not run");
      },
    });

    expect(() => problem.toJSON()).toThrow(
      expect.objectContaining({ code: "problems-core/invalid-extensions" }),
    );
    expect(getterCalls).toBe(0);
  });

  it("should contain extension proxy traps introduced after construction", () => {
    const problem = new ExtensionProblem({ safe: true });
    Object.defineProperty(problem, "extensions", {
      configurable: true,
      enumerable: true,
      value: new Proxy(
        {},
        {
          ownKeys() {
            throw new Error("inspection failed");
          },
        },
      ),
      writable: true,
    });

    expect(() => problem.toJSON()).toThrow(
      expect.objectContaining({ code: "problems-core/invalid-extensions" }),
    );
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
