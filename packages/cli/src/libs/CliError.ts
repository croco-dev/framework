export type CliErrorCode =
  | "CROCO_CLI_NAME_INVALID"
  | "CROCO_CLI_PAGE_MODE_INVALID"
  | "CROCO_CLI_GENERATION_FAILED"
  | "CROCO_CLI_MANIFEST_MISSING"
  | "CROCO_CLI_MANIFEST_INVALID"
  | "CROCO_CLI_JSON_READ_FAILED"
  | "CROCO_CLI_UPGRADE_TARGET_MISSING"
  | "CROCO_CLI_UPGRADE_REPLACEMENTS_OVERLAP"
  | "CROCO_CLI_GENERATED_DEPENDENCY_MISSING"
  | "CROCO_CLI_NORMALIZATION_INVALID";

export class CliError extends Error {
  constructor(
    readonly code: CliErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CliError";
  }
}
