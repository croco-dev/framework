import type { ContractDiagnostic, ContractGraph } from "./ContractGraph";
import { getContractGraphErrors } from "./ContractGraph";

export type ContractGraphBlockingDiagnostics = {
  readonly errors: readonly ContractDiagnostic[];
  readonly blockingDiagnostics: readonly ContractDiagnostic[];
};

export function parseContractGraphStrictModeFlag(
  args: readonly string[],
  flags: {
    readonly strict: string;
    readonly compatibility: string;
  },
): boolean | null {
  const strict = args.includes(flags.strict);
  const compatibility = args.includes(flags.compatibility);

  if (strict && compatibility) {
    return null;
  }

  return !compatibility;
}

export function resolveContractGraphBlockingDiagnostics(
  graph: ContractGraph,
  failOnDiagnostics: boolean,
): ContractGraphBlockingDiagnostics {
  const errors = getContractGraphErrors(graph);

  return {
    errors,
    blockingDiagnostics: failOnDiagnostics ? graph.diagnostics : errors,
  };
}
