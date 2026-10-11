export type SourcePosition = {
  readonly byteOffset: number;
  readonly line: number;
  readonly column: number;
};

export type SourceLimits = {
  readonly maxBytes: number;
  readonly maxRecords: number;
  readonly maxRowBytes: number;
};

export type SourceField = {
  readonly name: string;
  readonly type: "string" | "number" | "date";
  readonly nullable?: boolean;
  readonly nullValues?: readonly string[];
};

export type SourceSchema = {
  readonly format: "csv" | "jsonl";
  readonly encoding: "utf-8";
  readonly fields: readonly SourceField[];
  readonly limits: SourceLimits;
  readonly delimiter?: string;
  readonly header?: boolean;
};

export type SourceValue = string | number | Date | null;
export type SourceRow = Readonly<Record<string, SourceValue>>;
