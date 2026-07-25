import { InvalidMeterDimensionProblem } from "./problems/InvalidMeterDimensionProblem";

export type MeterAggregation = "COUNT" | "SUM";
export type MeterBillingIntent = "local" | "required";
export type MeterDimensionValue = string | number | boolean;

declare const METER_REF_BRAND: unique symbol;

export type EnumDimension<
  Values extends readonly [MeterDimensionValue, ...MeterDimensionValue[]] = readonly [
    MeterDimensionValue,
    ...MeterDimensionValue[],
  ],
> = {
  readonly kind: "enum";
  readonly values: Values;
};

export type MeterDimensionSchema = Readonly<Record<string, EnumDimension>>;

export type MeterRef<
  Key extends string = string,
  Aggregation extends MeterAggregation = MeterAggregation,
  Unit extends string = string,
  Dimensions extends MeterDimensionSchema = MeterDimensionSchema,
  Billing extends MeterBillingIntent = MeterBillingIntent,
> = {
  readonly key: Key;
  readonly aggregation: Aggregation;
  readonly unit: Unit;
  readonly dimensions: Dimensions;
  readonly billing: Billing;
  readonly [METER_REF_BRAND]: true;
};

export type MeterDefinitionOptions<
  Key extends string,
  Aggregation extends MeterAggregation,
  Unit extends string,
  Dimensions extends MeterDimensionSchema,
  Billing extends MeterBillingIntent,
> = {
  readonly key: Key;
  readonly aggregation: Aggregation;
  readonly unit: Unit;
  readonly dimensions?: Dimensions;
  readonly billing?: Billing;
};

type DimensionValues<Schema extends MeterDimensionSchema> = {
  readonly [Key in keyof Schema]: Schema[Key] extends EnumDimension<infer Values>
    ? Values[number]
    : never;
};

type MeterDimensionsInput<Schema extends MeterDimensionSchema> = keyof Schema extends never
  ? { readonly dimensions?: never }
  : { readonly dimensions: DimensionValues<Schema> };

type MeterEventInput<Billing extends MeterBillingIntent> = Billing extends "required"
  ? { readonly eventId: string }
  : { readonly eventId?: string };

type MeterValueInput<Aggregation extends MeterAggregation> = Aggregation extends "COUNT"
  ? { readonly value?: number }
  : { readonly value: number };

export type MeterRecordInput<Meter extends MeterRef> =
  Meter extends MeterRef<string, infer Aggregation, string, infer Dimensions, infer Billing>
    ? {
        readonly tenantId: string;
        readonly metadata?: Record<string, unknown>;
      } & MeterDimensionsInput<Dimensions> &
        MeterEventInput<Billing> &
        MeterValueInput<Aggregation>
    : never;

export type CountMeterRef = MeterRef<
  string,
  "COUNT",
  string,
  MeterDimensionSchema,
  MeterBillingIntent
>;

function validateDimensionValues(values: readonly MeterDimensionValue[]): void {
  for (const value of values) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new InvalidMeterDimensionProblem(
        `Numeric enum values must be finite; received '${String(value)}'`,
      );
    }
  }
}

export const dimension = Object.freeze({
  enum<const Values extends readonly [MeterDimensionValue, ...MeterDimensionValue[]]>(
    values: Values,
  ): EnumDimension<Values> {
    validateDimensionValues(values);

    return Object.freeze({
      kind: "enum" as const,
      values: Object.freeze([...values]) as unknown as Values,
    });
  },
});

function normalizeDimensions<Dimensions extends MeterDimensionSchema>(
  dimensions: Dimensions | undefined,
): Dimensions {
  const normalized = Object.fromEntries(
    Object.entries(dimensions ?? {})
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, descriptor]) => {
        validateDimensionValues(descriptor.values);
        return [
          key,
          Object.freeze({
            kind: descriptor.kind,
            values: Object.freeze([...descriptor.values]),
          }),
        ];
      }),
  );

  return Object.freeze(normalized) as Dimensions;
}

/**
 * Defines an inspectable, serializable usage meter while retaining literal keys and dimensions.
 */
export function defineMeter<
  const Key extends string,
  const Aggregation extends MeterAggregation,
  const Unit extends string,
  const Dimensions extends MeterDimensionSchema = Record<never, never>,
  const Billing extends MeterBillingIntent = "local",
>(
  options: MeterDefinitionOptions<Key, Aggregation, Unit, Dimensions, Billing>,
): MeterRef<Key, Aggregation, Unit, Dimensions, Billing> {
  return Object.freeze({
    key: options.key,
    aggregation: options.aggregation,
    unit: options.unit,
    dimensions: normalizeDimensions(options.dimensions),
    billing: options.billing ?? "local",
  }) as MeterRef<Key, Aggregation, Unit, Dimensions, Billing>;
}
