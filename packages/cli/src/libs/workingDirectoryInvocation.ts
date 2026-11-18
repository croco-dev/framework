import { resolve } from "node:path";

export function parseWorkingDirectoryInvocation(
  args: readonly string[],
  runtimeCwd: string | undefined,
  options: {
    readonly allowOptionLikeEqualsValue?: boolean;
    readonly shortOptions?: readonly string[];
  } = {},
):
  | {
      readonly args: string[];
      readonly cwd: string | undefined;
      readonly cwdOptionIndices: ReadonlySet<number>;
    }
  | { readonly diagnostic: string } {
  const forwarded: string[] = [];
  const cwdOptionIndices = new Set<number>();
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

    const optionIndex = index;
    const separateValue = argument === "--cwd";
    const value = separateValue ? args[++index] : argument.slice("--cwd=".length);
    if (
      !value ||
      (value.startsWith("--") && (separateValue || !options.allowOptionLikeEqualsValue)) ||
      (separateValue && options.shortOptions?.includes(value))
    ) {
      return {
        diagnostic: "[CROCO_CLI_MISSING_VALUE] Missing working directory. Pass --cwd <path>.",
      };
    }
    cwdOptionIndices.add(optionIndex);
    cwdOptionIndices.add(index);
    cliCwd = value;
  }

  return {
    args: forwarded,
    cwd: cliCwd === undefined ? runtimeCwd : resolve(runtimeCwd ?? process.cwd(), cliCwd),
    cwdOptionIndices,
  };
}
