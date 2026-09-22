import { describe, expect, it } from "vitest";
import { DESKTOP_REMOVED_MESSAGE } from "../commands/desktopRemoved.js";
import { runCroco } from "../commands/root.js";

describe("removed desktop command", () => {
  it.each([
    ["generate", ["desktop", "generate", "--config", "croco.desktop.ts"]],
    ["check", ["desktop", "check", "--config", "croco.desktop.ts"]],
    ["diff", ["desktop", "diff", "--config", "croco.desktop.ts"]],
    [
      "check with a separated root cwd",
      ["--cwd", "workspace target", "desktop", "check", "--config", "croco.desktop.ts"],
    ],
    [
      "check with an equals-form root cwd",
      ["--cwd=workspace target", "desktop", "check", "--config=croco.desktop.ts"],
    ],
  ] as const)("rejects the former desktop %s command", async (_name, argv) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const result = await runCroco(argv, {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 1 });
    expect(stdout).toEqual([]);
    expect(stderr).toEqual([DESKTOP_REMOVED_MESSAGE]);
  });

  it("does not treat a separated cwd value as the desktop command", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const result = await runCroco(["--cwd", "desktop", "doctor", "--help"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    });

    expect(result).toEqual({ exitCode: 0 });
    expect(stdout.join("\n")).toContain("croco doctor");
    expect(stderr).toEqual([]);
  });
});
