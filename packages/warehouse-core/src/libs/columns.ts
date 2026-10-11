import type { Column, ColumnMetadata } from "./types";
import { integer } from "./primitives";

type Metadata = Omit<ColumnMetadata, "nullable">;
type Bounds = { readonly min?: bigint | string; readonly max?: bigint | string };
const bounds = (options: Bounds) => ({
  ...(options.min === undefined ? {} : { min: integer(options.min) }),
  ...(options.max === undefined ? {} : { max: integer(options.max) }),
});
export const c = {
  id: (metadata: Metadata = {}) => ({ ...metadata, type: "id" as const }),
  string: (metadata: Metadata = {}) => ({ ...metadata, type: "string" as const }),
  boolean: (metadata: Metadata = {}) => ({ ...metadata, type: "boolean" as const }),
  subjectId: (subject: string, metadata: Metadata = {}) => ({
    ...metadata,
    type: "subject" as const,
    subject,
  }),
  currencyCode: (metadata: Metadata = {}) => ({ ...metadata, type: "currency" as const }),
  int64: (options: Bounds = {}, metadata: Metadata = {}) => ({
    ...metadata,
    type: "int64" as const,
    ...bounds(options),
  }),
  moneyMinor: <const Currency extends string>(
    options: Bounds & { readonly currency: Currency },
    metadata: Metadata = {},
  ) => ({
    ...metadata,
    type: "money" as const,
    ...bounds(options),
    currency: options.currency,
  }),
  decimal: (
    options: { readonly precision: number; readonly scale: number },
    metadata: Metadata = {},
  ) => ({
    ...metadata,
    type: "decimal" as const,
    ...options,
  }),
  instant: (
    options: { readonly precision: "second" | "millisecond" | "microsecond" },
    metadata: Metadata = {},
  ) => ({
    ...metadata,
    type: "instant" as const,
    ...options,
  }),
  date: (options: { readonly zone: string }, metadata: Metadata = {}) => ({
    ...metadata,
    type: "date" as const,
    ...options,
  }),
  nullable: <C extends Column>(column: C): C & { readonly nullable: true } => ({
    ...column,
    nullable: true,
  }),
};
