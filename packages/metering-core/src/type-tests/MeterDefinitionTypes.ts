import { Metered } from "../libs/decorators/Metered";
import type { MeterDescriptor, MeterRecordInput } from "../libs/MeterDefinition";
import { defineMeter, dimension } from "../libs/MeterDefinition";
import type { MeteringService } from "../libs/MeteringService";

type Equal<TLeft, TRight> =
  (<TValue>() => TValue extends TLeft ? 1 : 2) extends <TValue>() => TValue extends TRight ? 1 : 2
    ? true
    : false;
type Assert<TCondition extends true> = TCondition;

const aiTokens = defineMeter({
  key: "ai.tokens",
  aggregation: "SUM",
  unit: "token",
  dimensions: {
    model: dimension.enum(["gpt-5", "gpt-5-mini"]),
  },
  billing: "required",
});

const localRequest = defineMeter({
  key: "api.requests",
  aggregation: "COUNT",
  unit: "request",
  dimensions: {},
  billing: "local",
});

const regionalRequest = defineMeter({
  key: "regional.requests",
  aggregation: "COUNT",
  unit: "request",
  dimensions: {
    region: dimension.enum(["ap-northeast-2"]),
  },
  billing: "local",
});

const globalRequest = defineMeter({
  key: "global.requests",
  aggregation: "COUNT",
  unit: "request",
  dimensions: {
    region: dimension.enum(["us-east-1"]),
  },
  billing: "local",
});

export type MeterKeyInference = Assert<Equal<typeof aiTokens.descriptor.key, "ai.tokens">>;
export type MeterUnitInference = Assert<Equal<typeof aiTokens.descriptor.unit, "token">>;
export type MeterDimensionInference = Assert<
  Equal<(typeof aiTokens.descriptor.dimensions.model.values)[number], "gpt-5" | "gpt-5-mini">
>;
export type MeterDescriptorCompatibility = Assert<
  Equal<typeof aiTokens.descriptor extends MeterDescriptor ? true : false, true>
>;

declare const service: MeteringService;

service.record(aiTokens, {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  dimensions: { model: "gpt-5" },
  metadata: { route: "/chat" },
});

service.record(localRequest, {
  tenantId: "tenant-1",
});

const annotatedLocalInput: MeterRecordInput<typeof localRequest> = {
  tenantId: "tenant-1",
};
service.record(localRequest, annotatedLocalInput);

Metered({ meter: localRequest });

declare const meterUnion: typeof aiTokens | typeof localRequest;
declare const dimensionMeterUnion: typeof regionalRequest | typeof globalRequest;
declare const decoratorMeterUnion: typeof localRequest | typeof regionalRequest;

// @ts-expect-error a union containing a billing-required SUM meter cannot omit eventId or value.
service.record(meterUnion, {
  tenantId: "tenant-1",
});

// @ts-expect-error a union meter must be narrowed before supplying branch-specific dimensions.
service.record(dimensionMeterUnion, {
  tenantId: "tenant-1",
  dimensions: { region: "ap-northeast-2" },
});

// @ts-expect-error typed COUNT meters always use the default value of one.
service.record(localRequest, {
  tenantId: "tenant-1",
  value: 2,
});

// @ts-expect-error typed COUNT inputs must omit the value key, including undefined.
service.record(localRequest, {
  tenantId: "tenant-1",
  value: undefined,
});

// @ts-expect-error dimensionless meters reject a dimensions object.
service.record(localRequest, {
  tenantId: "tenant-1",
  dimensions: {},
});

// @ts-expect-error typed meter inputs use eventId, not the compatibility idempotencyKey.
service.record(aiTokens, {
  tenantId: "tenant-1",
  idempotencyKey: "request-1",
  value: 42,
  dimensions: { model: "gpt-5" },
});

// @ts-expect-error bare @Metered accepts only dimensionless local COUNT meters.
Metered({ meter: aiTokens });

// @ts-expect-error every member of a decorator meter union must be dimensionless.
Metered({ meter: decoratorMeterUnion });

// @ts-expect-error billing-required meters require a stable eventId.
service.record(aiTokens, {
  tenantId: "tenant-1",
  value: 42,
  dimensions: { model: "gpt-5" },
});

// @ts-expect-error SUM meters require an explicit value.
service.record(aiTokens, {
  tenantId: "tenant-1",
  eventId: "request-1",
  dimensions: { model: "gpt-5" },
});

// @ts-expect-error declared dimensions are required.
service.record(aiTokens, {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
});

// @ts-expect-error enum dimensions accept only declared values.
service.record(aiTokens, {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  dimensions: {
    model: "gpt-4",
  },
});

const dimensionsWithExtraKey = {
  model: "gpt-5",
  region: "ap-northeast-2",
} as const;

// @ts-expect-error dimension variables cannot carry undeclared billing keys.
service.record(aiTokens, {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  dimensions: dimensionsWithExtraKey,
});

// @ts-expect-error undeclared billing dimensions are rejected.
service.record(aiTokens, {
  tenantId: "tenant-1",
  eventId: "request-1",
  value: 42,
  dimensions: {
    model: "gpt-5",
    region: "ap-northeast-2",
  },
});
