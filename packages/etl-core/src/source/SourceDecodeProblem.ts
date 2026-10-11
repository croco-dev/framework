import { Problem, ProblemCategory } from "@croco/problems-core";
import type { SourcePosition } from "./types";

export type SourceDecodeReason =
  | "invalid-schema"
  | "byte-limit"
  | "record-limit"
  | "row-limit"
  | "invalid-utf8"
  | "invalid-csv"
  | "invalid-jsonl"
  | "invalid-header"
  | "invalid-field";

export class SourceDecodeProblem extends Problem {
  readonly code = "etl-core/source-decode-failed";
  readonly category = ProblemCategory.ValidationError;

  constructor(
    readonly reason: SourceDecodeReason,
    readonly position: SourcePosition,
    detail: string,
    readonly field?: string,
  ) {
    super(
      undefined,
      undefined,
      `${detail} at line ${position.line}, column ${position.column}, byte ${position.byteOffset}.`,
      {
        extensions: { reason, ...position, ...(field === undefined ? {} : { field }) },
      },
    );
  }
}
