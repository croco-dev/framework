export class NoTtyError extends Error {
  constructor() {
    super("TTY required for interactive prompts. Use --dry-run or provide values via flags.");
    this.name = "NoTtyError";
  }
}

export type PromptResult<T> =
  | {
      readonly status: "completed";
      readonly value: T;
    }
  | {
      readonly status: "cancelled";
    };

function ensureTty(): void {
  if (!process.stdout.isTTY) throw new NoTtyError();
}

export async function confirmOverwrite(path: string): Promise<PromptResult<boolean>> {
  ensureTty();
  const { confirm, isCancel } = await import("@clack/prompts");
  const result = await confirm({ message: `Overwrite ${path}?` });
  return isCancel(result)
    ? { status: "cancelled" }
    : { status: "completed", value: result as boolean };
}

export async function selectMode(
  options: { label: string; value: string }[],
): Promise<PromptResult<string>> {
  ensureTty();
  const { select, isCancel } = await import("@clack/prompts");
  const result = await select({ message: "Select mode", options });
  return isCancel(result)
    ? { status: "cancelled" }
    : { status: "completed", value: result as string };
}

export async function textInput(
  message: string,
  validate?: (value: string) => string | void,
): Promise<PromptResult<string>> {
  ensureTty();
  const { text, isCancel } = await import("@clack/prompts");
  const result = await text({
    message,
    ...(validate === undefined
      ? {}
      : {
          validate: (value: string) => {
            const validation = validate(value);
            return typeof validation === "string" ? validation : undefined;
          },
        }),
  });
  return isCancel(result)
    ? { status: "cancelled" }
    : { status: "completed", value: result as string };
}
