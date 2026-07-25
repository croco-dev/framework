import { describe, expectTypeOf, it } from "vitest";
import { Metered } from "../libs/decorators/Metered";
import { defineMeter, dimension } from "../libs/MeterRef";
import type { MeterRecordInput } from "../libs/MeterRef";

const aiTokens = defineMeter({
  key: "ai.tokens",
  aggregation: "SUM",
  unit: "token",
  dimensions: {
    model: dimension.enum(["gpt-5", "gpt-5-mini"]),
  },
  billing: "required",
});

const localCalls = defineMeter({
  key: "api.calls",
  aggregation: "COUNT",
  unit: "request",
});

const billableCalls = defineMeter({
  key: "billable.calls",
  aggregation: "COUNT",
  unit: "request",
  billing: "required",
});

const regionalCalls = defineMeter({
  key: "regional.calls",
  aggregation: "COUNT",
  unit: "request",
  dimensions: {
    region: dimension.enum(["apac", "emea"]),
  },
});

describe("MeterRef types", () => {
  it("preserves literal keys and dimension domains", () => {
    expectTypeOf(aiTokens.key).toEqualTypeOf<"ai.tokens">();
    expectTypeOf<MeterRecordInput<typeof aiTokens>["dimensions"]["model"]>().toEqualTypeOf<
      "gpt-5" | "gpt-5-mini"
    >();
  });

  it("accepts valid usage envelopes and COUNT decorators", () => {
    const valid: MeterRecordInput<typeof aiTokens> = {
      tenantId: "tenant-1",
      eventId: "request-1",
      value: 42,
      dimensions: { model: "gpt-5" },
    };

    class Example {
      @Metered({ meter: localCalls })
      local(): void {}

      @Metered({ meter: billableCalls, eventIdExtractor: () => "request-1" })
      billable(): void {}

      @Metered({
        meter: regionalCalls,
        dimensionsExtractor: () => ({ region: "apac" as const }),
      })
      regional(): void {}
    }

    expectTypeOf(valid).toMatchTypeOf<MeterRecordInput<typeof aiTokens>>();
    void Example;
  });
});

const missingEventId: MeterRecordInput<typeof aiTokens> = {
  tenantId: "tenant-1",
  value: 42,
  dimensions: { model: "gpt-5" },
  // @ts-expect-error billing-required meters require eventId
  eventId: undefined,
};

const missingDimensions: MeterRecordInput<typeof aiTokens> = {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  // @ts-expect-error declared dimensions are required
  dimensions: undefined,
};

const invalidDimension: MeterRecordInput<typeof aiTokens> = {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  dimensions: {
    // @ts-expect-error values are restricted to the declared enum
    model: "gpt-4",
  },
};

const extraDimension: MeterRecordInput<typeof aiTokens> = {
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
    meter: aiTokens,
    eventIdExtractor: () => "request-1",
    dimensionsExtractor: () => ({ model: "gpt-5" }),
  })
  sum(): void {}

  // @ts-expect-error billing-required COUNT meters require an eventId extractor
  @Metered({ meter: billableCalls })
  missingEvent(): void {}

  // @ts-expect-error dimensioned COUNT meters require a dimensions extractor
  @Metered({ meter: regionalCalls })
  missingDimensions(): void {}
}

void missingEventId;
void missingDimensions;
void invalidDimension;
void extraDimension;
void InvalidDecorators;
