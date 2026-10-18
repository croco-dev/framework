import { resolve } from "node:path";

export function parseCodegenInvocation(
  args: readonly string[],
  runtimeCwd: string | undefined,
): { readonly args: string[]; readonly cwd: string | undefined } | { readonly diagnostic: string } {
  const forwarded: string[] = [];
  let cliCwd: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === undefined) break;
    if (argument === "--") {
      forwarded.push(...args.slice(index));
      break;
    }
    if (argument !== "--cwd" && !argument.startsWith("--cwd=")) {
      forwarded.push(argument);
      continue;
    }

    const value = argument === "--cwd" ? args[++index] : argument.slice("--cwd=".length);
    if (!value || value.startsWith("--")) {
      return {
        diagnostic: "[CROCO_CLI_MISSING_VALUE] Missing working directory. Pass --cwd <path>.",
      };
    }
    cliCwd = value;
  }

  return {
    args: forwarded,
    cwd: cliCwd === undefined ? runtimeCwd : resolve(runtimeCwd ?? process.cwd(), cliCwd),
  };
}
