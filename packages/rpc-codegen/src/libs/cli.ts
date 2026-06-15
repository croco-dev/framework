type CliOptions = {
  readonly controllers: string;
  readonly outDir: string;
  readonly reactQuery: boolean;
};

type CliParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "invalid" }
  | { readonly kind: "run"; readonly options: CliOptions };

type CliIo = {
  readonly stdout: (message: string) => void;
};

const defaultCliIo: CliIo = {
  stdout: (message) => console.log(message),
};

export async function runCli(args: readonly string[], io: CliIo = defaultCliIo): Promise<number> {
  const result = parseArgs(args);

  if (result.kind === "help") {
    printHelp(io);
    return 0;
  }

  if (result.kind === "invalid") {
    printHelp(io);
    return 1;
  }

  const [{ generateClientFiles }, { loadRoutes }] = await Promise.all([
    import("./generate"),
    import("./loadRoutes"),
  ]);
  const routes = await loadRoutes(result.options.controllers);
  const files = generateClientFiles(routes, result.options.outDir, {
    reactQuery: result.options.reactQuery,
  });

  for (const file of files) {
    io.stdout(file);
  }

  return 0;
}

export function parseArgs(args: readonly string[]): CliParseResult {
  if (args.includes("--help") || args.includes("-h")) {
    return { kind: "help" };
  }

  const controllers = getFlagValue(args, "--controllers");
  const outDir = getFlagValue(args, "--out");

  if (!controllers || !outDir) {
    return { kind: "invalid" };
  }

  return {
    kind: "run",
    options: {
      controllers,
      outDir,
      reactQuery: args.includes("--react-query"),
    },
  };
}

function getFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index >= 0 ? args[index + 1] : undefined;

  return value && !value.startsWith("--") ? value : null;
}

function printHelp(io: CliIo): void {
  io.stdout(`Usage: croco-rpc-codegen --controllers <glob> --out <dir> [--react-query]

Options:
  --controllers <glob>  Controller files to load
  --out <dir>           Output directory for generated clients
  --react-query         Generate React Query hooks
  --help, -h            Show this help message`);
}
