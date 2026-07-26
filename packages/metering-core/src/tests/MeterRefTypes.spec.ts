import { describe, expectTypeOf, it } from "vitest";
import { Metered } from "../libs/decorators/Metered";
import type { MeterRecordInput } from "../libs/MeterRef";
import { defineMeter, dimension } from "../libs/MeterRef";

const AI_TOKENS = defineMeter({
  key: "ai.tokens",
  aggregation: "SUM",
  unit: "token",
  dimensions: {
    model: dimension.enum(["gpt-5", "gpt-5-mini"]),
  },
  billing: "required",
});

const LOCAL_CALLS = defineMeter({
  key: "api.calls",
  aggregation: "COUNT",
  unit: "request",
});

const BILLABLE_CALLS = defineMeter({
  key: "billable.calls",
  aggregation: "COUNT",
  unit: "request",
  billing: "required",
});

const REGIONAL_CALLS = defineMeter({
  key: "regional.calls",
  aggregation: "COUNT",
  unit: "request",
  dimensions: {
    region: dimension.enum(["apac", "emea"]),
  },
});

describe("MeterRef types", () => {
  it("preserves literal keys and dimension domains", () => {
    expectTypeOf(AI_TOKENS.key).toEqualTypeOf<"ai.tokens">();
    expectTypeOf<MeterRecordInput<typeof AI_TOKENS>["dimensions"]["model"]>().toEqualTypeOf<
      "gpt-5" | "gpt-5-mini"
    >();
  });

  it("accepts valid usage envelopes and COUNT decorators", () => {
    const valid: MeterRecordInput<typeof AI_TOKENS> = {
      tenantId: "tenant-1",
      eventId: "request-1",
      value: 42,
      dimensions: { model: "gpt-5" },
    };

    class Example {
      @Metered({ meter: LOCAL_CALLS })
      local(): void {}

      @Metered({ meter: BILLABLE_CALLS, eventIdExtractor: () => "request-1" })
      billable(): void {}

      @Metered({
        meter: REGIONAL_CALLS,
        dimensionsExtractor: () => ({ region: "apac" as const }),
      })
      regional(): void {}
    }

    expectTypeOf(valid).toMatchTypeOf<MeterRecordInput<typeof AI_TOKENS>>();
    void Example;
  });
});

const missingEventId: MeterRecordInput<typeof AI_TOKENS> = {
  tenantId: "tenant-1",
  value: 42,
  dimensions: { model: "gpt-5" },
  // @ts-expect-error billing-required meters require eventId
  eventId: undefined,
};

const missingDimensions: MeterRecordInput<typeof AI_TOKENS> = {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  // @ts-expect-error declared dimensions are required
  dimensions: undefined,
};

const invalidDimension: MeterRecordInput<typeof AI_TOKENS> = {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  dimensions: {
    // @ts-expect-error values are restricted to the declared enum
    model: "gpt-4",
  },
};

const extraDimension: MeterRecordInput<typeof AI_TOKENS> = {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  dimensions: {
    model: "gpt-5",
    // @ts-expect-error undeclared dimension keys are rejected
    region: "us",
  },
};

class InvalidDecorators {
  @Metered({
    // @ts-expect-error SUM meters cannot use the default-value decorator path
    meter: AI_TOKENS,
    eventIdExtractor: () => "request-1",
    dimensionsExtractor: () => ({ model: "gpt-5" }),
  })
  sum(): void {}

  // @ts-expect-error billing-required COUNT meters require an eventId extractor
  @Metered({ meter: BILLABLE_CALLS })
  missingEvent(): void {}

  // @ts-expect-error dimensioned COUNT meters require a dimensions extractor
  @Metered({ meter: REGIONAL_CALLS })
  missingDimensions(): void {}
}

void missingEventId;
void missingDimensions;
void invalidDimension;
void extraDimension;
void InvalidDecorators;
