import { describe, expect, expectTypeOf, it } from "vitest";
import { SearchTransformRegistrationConflictProblem } from "../libs/problems/SearchProblems";
import { derive } from "../libs/transforms/derive";
import { InMemorySearchTransformRegistry } from "../libs/transforms/SearchTransformRegistry";
import { textTransforms } from "../libs/transforms/textTransforms";
import { SearchTransformAdapter } from "../libs/transforms/types";
import type { SearchTransformDefinition, SearchTransformRef } from "../libs/transforms/types";

type MockTransformOptions = {
  locale?: "en" | "ko";
};

class MockTransformAdapter extends SearchTransformAdapter<MockTransformOptions> {
  readonly id = "test.mock";
  readonly defaultSuffix = "_mock";

  constructor(private readonly prefix = "") {
    super();
  }

  transform(input: string, options: MockTransformOptions): string {
    return `${this.prefix}${input.toLocaleUpperCase(options?.locale)}`;
  }
}

function assertTransformReferenceTypes(
  registry: InMemorySearchTransformRegistry,
  ref: SearchTransformRef<MockTransformOptions>,
): void {
  // @ts-expect-error registered references reject options from another transform contract
  registry.apply(ref, "hello", { form: "nfd" });

  // @ts-expect-error transform references can only be created by the owning API
  const forgedRef: SearchTransformRef<MockTransformOptions> = {
    id: "test.mock",
    defaultSuffix: "_forged",
  };

  // @ts-expect-error transform option contracts cannot be rebound to another generic
  const reboundRef: SearchTransformRef<{ form?: "nfd" }> = ref;

  // @ts-expect-error adapter option contracts cannot be widened during registration
  registry.register<unknown>(new MockTransformAdapter());

  // @ts-expect-error adapter option contracts are invariant
  const widenedAdapter: SearchTransformAdapter<unknown> = new MockTransformAdapter();

  // @ts-expect-error definitions describe derived fields but cannot execute against a registry
  registry.apply(textTransforms.initials, "hello", { locale: "ko" });

  void forgedRef;
  void reboundRef;
  void widenedAdapter;
}

describe("derive()", () => {
  it("returns SearchDerivedFieldConfig with transformId", () => {
    const config = derive(textTransforms.initials);

    expect(config.transformId).toBe("text.initials");
  });

  it("accepts options with correct type", () => {
    const config = derive(textTransforms.initials, {
      options: { locale: "ko" },
      filterable: true,
    });

    expect(config.options).toEqual({ locale: "ko" });
    expect(config.filterable).toBe(true);
  });

  it("supports custom field name via as option", () => {
    const config = derive(textTransforms.decomposed, { as: "name_jamo" });

    expect(config.as).toBe("name_jamo");
  });

  it("accepts a registered reference with its inferred options", () => {
    const registry = new InMemorySearchTransformRegistry();
    const ref = registry.register(new MockTransformAdapter());

    const config = derive(ref, { options: { locale: "ko" } });

    expect(config).toMatchObject({ transformId: "test.mock", options: { locale: "ko" } });
  });
});

describe("SearchTransformRegistry", () => {
  it("returns and reuses the canonical typed reference for an adapter", () => {
    const registry = new InMemorySearchTransformRegistry();
    const mockAdapter = new MockTransformAdapter();

    const ref = registry.register(mockAdapter);

    expect(ref).toEqual({ id: "test.mock", defaultSuffix: "_mock" });
    expect(Object.isFrozen(ref)).toBe(true);
    expect(registry.register(mockAdapter)).toBe(ref);
    expect(registry.get(ref)).toBe(mockAdapter);
    expectTypeOf(ref).toEqualTypeOf<SearchTransformRef<MockTransformOptions>>();
  });

  it("infers adapter options when applying its registered reference", () => {
    const registry = new InMemorySearchTransformRegistry();
    const ref = registry.register(new MockTransformAdapter());

    const result = registry.apply(ref, "hello", { locale: "en" });

    expect(result).toBe("HELLO");
    expectTypeOf(result).toEqualTypeOf<string>();
  });

  it("rejects a different adapter with the same ID without replacing the original", () => {
    const registry = new InMemorySearchTransformRegistry();
    const originalAdapter = new MockTransformAdapter("original:");
    const originalRef = registry.register(originalAdapter);

    expect(() => registry.register(new MockTransformAdapter("replacement:"))).toThrow(
      SearchTransformRegistrationConflictProblem,
    );
    expect(registry.get(originalRef)).toBe(originalAdapter);
    expect(registry.apply(originalRef, "hello", { locale: "en" })).toBe("original:HELLO");
  });

  it("does not resolve a same-ID reference created by another registry", () => {
    const registry = new InMemorySearchTransformRegistry();
    const registeredRef = registry.register(new MockTransformAdapter("registered:"));
    const foreignRegistry = new InMemorySearchTransformRegistry();
    const foreignRef = foreignRegistry.register(new MockTransformAdapter("foreign:"));

    expect(registry.get(foreignRef)).toBeUndefined();
    expect(() => registry.apply(foreignRef, "hello", { locale: "en" })).toThrow(
      "Transform not found: 'test.mock'",
    );
    expect(registry.apply(registeredRef, "hello", { locale: "en" })).toBe("registered:HELLO");
  });
});

describe("textTransforms", () => {
  it("defines built-in text transform references", () => {
    expect(textTransforms.initials).toEqual({
      id: "text.initials",
      defaultSuffix: "_initials",
    });
    expect(textTransforms.decomposed).toEqual({
      id: "text.decomposed",
      defaultSuffix: "_decomposed",
    });
    expect(textTransforms.romanized).toEqual({
      id: "text.romanized",
      defaultSuffix: "_romanized",
    });
    expectTypeOf(textTransforms.initials).toEqualTypeOf<
      SearchTransformDefinition<{ locale?: string }>
    >();
  });
});
