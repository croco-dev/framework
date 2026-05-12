export class NoTtyError extends Error {
  constructor() {
    super("TTY required for interactive prompts. Use --dry-run or provide values via flags.");
    this.name = "NoTtyError";
  }
}

function ensureTty(): void {
  if (!process.stdout.isTTY) throw new NoTtyError();
}

export async function confirmOverwrite(path: string): Promise<boolean> {
  ensureTty();
  const { confirm, isCancel } = await import("@clack/prompts");
  const result = await confirm({ message: `Overwrite ${path}?` });
  if (isCancel(result)) process.exit(130);
  return result as boolean;
}

export async function selectMode(options: { label: string; value: string }[]): Promise<string> {
  ensureTty();
  const { select, isCancel } = await import("@clack/prompts");
  const result = await select({ message: "Select mode", options });
  if (isCancel(result)) process.exit(130);
  return result as string;
}

export async function textInput(
  message: string,
  validate?: (value: string) => string | void,
): Promise<string> {
  ensureTty();
  const { text, isCancel } = await import("@clack/prompts");
  const result = await text({
    message,
    validate: validate as ((value: string) => string | Error | undefined) | undefined,
  });
  if (isCancel(result)) process.exit(130);
  return result as string;
}
