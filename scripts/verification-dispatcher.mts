import { getVerificationCommand } from "./verification-manifest.mts";

const VERIFICATION_COMMAND_PATTERN =
  /(?:^|&&\s*)node --experimental-strip-types scripts\/verification-command\.mts --id ([\w-]+)(?:\s|$)/;
const EXACT_VERIFICATION_COMMAND_PATTERN =
  /^node --experimental-strip-types scripts\/verification-command\.mts --id ([\w-]+)$/;

export type VerificationDispatcherMatchOptions = {
  readonly exact?: boolean;
};

export function matchVerificationDispatcherCommand(
  command: string,
  options: VerificationDispatcherMatchOptions = {},
): string | null {
  const pattern = options.exact ? EXACT_VERIFICATION_COMMAND_PATTERN : VERIFICATION_COMMAND_PATTERN;
  return pattern.exec(command)?.[1] ?? null;
}

export function resolvesVerificationDispatcherToScript(
  command: string,
  commandId: string,
  scriptPath: string,
  options: VerificationDispatcherMatchOptions = {},
): boolean {
  if (command.includes(scriptPath)) return true;
  const dispatcherCommandId = matchVerificationDispatcherCommand(command, options);
  if (dispatcherCommandId !== commandId) return false;
  return getVerificationCommand(commandId).command.includes(scriptPath);
}
