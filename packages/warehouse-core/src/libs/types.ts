export type ColumnMetadata = {
  readonly nullable?: true;
  readonly description?: string;
  readonly sensitivity?: "public" | "internal" | "sensitive";
};
export type Column = ColumnMetadata &
  (
    | { readonly type: "id" | "string" | "boolean" | "currency" }
    | { readonly type: "subject"; readonly subject: string }
    | { readonly type: "int64"; readonly min?: string; readonly max?: string }
    | {
        readonly type: "money";
        readonly currency: string;
        readonly min?: string;
        readonly max?: string;
      }
    | { readonly type: "decimal"; readonly precision: number; readonly scale: number }
    | { readonly type: "instant"; readonly precision: "second" | "millisecond" | "microsecond" }
    | { readonly type: "date"; readonly zone: string }
  );
export type Columns = Readonly<Record<string, Column>>;
type ValueForType<T extends Column["type"]> = T extends "boolean"
  ? boolean
  : T extends "int64" | "money"
    ? bigint | string
    : string;
type ColumnInput<C extends Column> =
  | ValueForType<C["type"]>
  | (C extends { readonly nullable: true } ? null : never);
export type FactRow<F extends { readonly columns: Columns }> = {
  readonly [K in keyof F["columns"]]-?: ColumnInput<F["columns"][K]>;
};
export type RequiredColumnKey<C extends Columns> = {
  [K in keyof C]: C[K] extends { readonly nullable: true } ? never : K;
}[keyof C] &
  string;
export type ColumnKeyOfType<C extends Columns, T extends Column["type"]> = {
  [K in keyof C]: C[K] extends { readonly nullable: true }
    ? never
    : Extract<C[K], { readonly type: T }> extends never
      ? never
      : K;
}[keyof C] &
  string;
type MeasureKey<C extends Columns> = {
  [K in keyof C]: Extract<C[K], { readonly type: "int64" | "money" | "decimal" }> extends never
    ? never
    : K;
}[keyof C] &
  string;
export type Measure = { readonly unit: string; readonly reaggregate: "sum" | "none" };
export type FactOptions<C extends Columns = Columns> = {
  readonly version: number;
  readonly scope: "tenant" | "application";
  readonly grain: { readonly description: string; readonly key: readonly RequiredColumnKey<C>[] };
  readonly columns: C;
  readonly policyRefs?: readonly string[];
  readonly sourceRefs?: readonly string[];
  readonly description?: string;
} & (
  | {
      readonly kind: "transaction";
      readonly time: { readonly event: ColumnKeyOfType<C, "instant"> };
      readonly write: {
        readonly mode: "append";
        readonly duplicate: "ignore-identical";
        readonly conflict: "reject";
      };
      readonly aggregate?: never;
    }
  | {
      readonly kind: "aggregate";
      readonly time: { readonly event: ColumnKeyOfType<C, "date"> };
      readonly write: {
        readonly mode: "replace-range";
        readonly duplicate: "ignore-identical";
        readonly conflict: "reject";
      };
      readonly aggregate: {
        readonly date: ColumnKeyOfType<C, "date">;
        readonly series: readonly RequiredColumnKey<C>[];
        readonly dimensions: readonly RequiredColumnKey<C>[];
        readonly measures: Readonly<Partial<Record<MeasureKey<C>, Measure>>>;
      };
    }
);
export type FactDeclaration<C extends Columns = Columns> = FactOptions<C> & {
  readonly name: string;
};
export type FactDescriptor = FactDeclaration & {
  readonly irVersion: 1;
  readonly compilerVersion: "1";
  readonly semanticHash: string;
};
export type CanonicalRow = Readonly<Record<string, string | boolean | null>>;
export type TrustedScope = {
  readonly application: string;
  readonly environment: string;
  readonly tenant?: string;
};
