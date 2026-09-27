import { Problem, ProblemCategory } from "@croco/problems-core";

export class WarehouseContractError extends Problem {
  readonly path?: string;

  constructor(code: string, path?: string) {
    super(code, ProblemCategory.ValidationError, code);
    this.path = path;
  }
}

export function assertContract(condition: unknown, code: string, path?: string): asserts condition {
  if (!condition) throw new WarehouseContractError(code, path);
}
