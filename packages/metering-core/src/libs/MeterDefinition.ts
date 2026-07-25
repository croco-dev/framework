import { InvalidMeterDefinitionProblem } from "./problems/InvalidMeterDefinitionProblem";

const METER_REF_BRAND = Symbol("croco.meter-ref");
const METER_REFS = new WeakSet<object>();

export type MeterAggregation = "COUNT" | "SUM";
export type MeterBillingIntent = "local" | "required";
export type MeterDimensionValue = string;

export type EnumDimension<TValues extends readonly string[] = readonly string[]> = {
  readonly kind: "enum";
  readonly values: TValues;
};

export type MeterDimension = EnumDimension;
export type MeterDimensionSchema = Readonly<Record<string, MeterDimension>>;

export type MeterDescriptor<
  TKey extends string = string,
  TAggregation extends MeterAggregation = MeterAggregation,
  TUnit extends string = string,
  TDimensions extends MeterDimensionSchema = MeterDimensionSchema,
  TBilling extends MeterBillingIntent = MeterBillingIntent,
> = {
  readonly key: TKey;
  readonly aggregation: TAggregation;
  readonly unit: TUnit;
  readonly dimensions: TDimensions;
  readonly billing: TBilling;
};

export type MeterRef<
  TKey extends string = string,
  TAggregation extends MeterAggregation = MeterAggregation,
  TUnit extends string = string,
  TDimensions extends MeterDimensionSchema = MeterDimensionSchema,
  TBilling extends MeterBillingIntent = MeterBillingIntent,
> = {
  readonly descriptor: MeterDescriptor<TKey, TAggregation, TUnit, TDimensions, TBilling>;
  readonly [METER_REF_BRAND]: {
    readonly key: TKey;
    readonly aggregation: TAggregation;
    readonly unit: TUnit;
    readonly dimensions: TDimensions;
    readonly billing: TBilling;
  };
};

export type MeterDefinitionInput<
  TKey extends string,
  TAggregation extends MeterAggregation,
  TUnit extends string,
  TDimensions extends MeterDimensionSchema,
  TBilling extends MeterBillingIntent,
> = {
  readonly key: TKey;
  readonly aggregation: TAggregation;
  readonly unit: TUnit;
  readonly dimensions: TDimensions;
  readonly billing: TBilling;
};

type EnumValue<TDimension extends MeterDimension> =
  TDimension extends EnumDimension<infer TValues> ? TValues[number] : never;

export type MeterDimensionValues<TDimensions extends MeterDimensionSchema> = {
  readonly [TKey in keyof TDimensions]: EnumValue<TDimensions[TKey]>;
};

export type MeterAggregationOf<TMeter extends MeterRef> = TMeter["descriptor"]["aggregation"];
export type MeterBillingOf<TMeter extends MeterRef> = TMeter["descriptor"]["billing"];
export type MeterDimensionsOf<TMeter extends MeterRef> = TMeter["descriptor"]["dimensions"];

type MeterValueInput<TAggregation extends MeterAggregation> = [TAggregation] extends ["COUNT"]
  ? {}
  : { readonly value: number };

type MeterEventInput<TBilling extends MeterBillingIntent> = [TBilling] extends ["local"]
  ? { readonly eventId?: string }
  : { readonly eventId: string };

type MeterDimensionsInput<TDimensions extends MeterDimensionSchema> =
  keyof TDimensions extends never ? {} : { readonly dimensions: MeterDimensionValues<TDimensions> };

export type MeterRecordInput<TMeter extends MeterRef> = {
  readonly tenantId: string;
  readonly metadata?: Record<string, unknown>;
} & MeterValueInput<MeterAggregationOf<TMeter>> &
  MeterEventInput<MeterBillingOf<TMeter>> &
  MeterDimensionsInput<MeterDimensionsOf<TMeter>>;

export const dimension = Object.freeze({
  enum<const TValues extends readonly [string, ...string[]]>(
    values: TValues,
  ): EnumDimension<TValues> {
    if (!Array.isArray(values) || values.length === 0) {
      throw new InvalidMeterDefinitionProblem(
        "dimensions",
        "enum values must be a non-empty array",
      );
    }

    if (values.some((value) => typeof value !== "string" || value.length === 0)) {
      throw new InvalidMeterDefinitionProblem(
        "dimensions",
        "enum values must be non-empty strings",
      );
    }

    if (new Set(values).size !== values.length) {
      throw new InvalidMeterDefinitionProblem("dimensions", "enum values must be unique");
    }

    return Object.freeze({
      kind: "enum" as const,
      values: Object.freeze([...values]) as unknown as TValues,
    });
  },
});

export function defineMeter<
  const TKey extends string,
  const TAggregation extends MeterAggregation,
  const TUnit extends string,
  const TDimensions extends MeterDimensionSchema,
  const TBilling extends MeterBillingIntent,
>(
  definition: MeterDefinitionInput<TKey, TAggregation, TUnit, TDimensions, TBilling>,
): MeterRef<TKey, TAggregation, TUnit, TDimensions, TBilling> {
  if (!isPlainRecord(definition)) {
    throw new InvalidMeterDefinitionProblem("definition", "must be an object");
  }
  validateRequiredString("key", definition.key);
  validateRequiredString("unit", definition.unit);
  if (definition.aggregation !== "COUNT" && definition.aggregation !== "SUM") {
    throw new InvalidMeterDefinitionProblem("aggregation", "must be COUNT or SUM");
  }
  if (definition.billing !== "local" && definition.billing !== "required") {
    throw new InvalidMeterDefinitionProblem("billing", "must be local or required");
  }
  if (!isPlainRecord(definition.dimensions)) {
    throw new InvalidMeterDefinitionProblem("dimensions", "must be an object");
  }

  const dimensions = Object.fromEntries(
    Object.keys(definition.dimensions)
      .sort()
      .map((key) => {
        validateRequiredString("dimensions", key);
        const descriptor = definition.dimensions[key];

        if (!descriptor || descriptor.kind !== "enum" || !Array.isArray(descriptor.values)) {
          throw new InvalidMeterDefinitionProblem(
            `dimensions.${key}`,
            "must be created with dimension.enum()",
          );
        }
        if (descriptor.values.length === 0) {
          throw new InvalidMeterDefinitionProblem(
            `dimensions.${key}`,
            "enum values must not be empty",
          );
        }
        if (descriptor.values.some((value) => typeof value !== "string" || value.length === 0)) {
          throw new InvalidMeterDefinitionProblem(
            `dimensions.${key}`,
            "enum values must be non-empty strings",
          );
        }
        if (new Set(descriptor.values).size !== descriptor.values.length) {
          throw new InvalidMeterDefinitionProblem(
            `dimensions.${key}`,
            "enum values must be unique",
          );
        }

        return [
          key,
          Object.freeze({
            kind: "enum" as const,
            values: Object.freeze([...descriptor.values]),
          }),
        ];
      }),
  ) as TDimensions;

  const descriptor = Object.freeze({
    key: definition.key,
    aggregation: definition.aggregation,
    unit: definition.unit,
    dimensions: Object.freeze(dimensions),
    billing: definition.billing,
  });
  const meterRef = { descriptor } as MeterRef<TKey, TAggregation, TUnit, TDimensions, TBilling>;

  Object.defineProperty(meterRef, METER_REF_BRAND, {
    enumerable: false,
    value: descriptor,
  });
  METER_REFS.add(meterRef);

  return Object.freeze(meterRef);
}

export function isMeterRef(value: unknown): value is MeterRef {
  return (
    typeof value === "object" &&
    value !== null &&
    METER_REFS.has(value) &&
    METER_REF_BRAND in value &&
    "descriptor" in value
  );
}

function validateRequiredString(field: string, value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new InvalidMeterDefinitionProblem(field, "must not be empty");
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
