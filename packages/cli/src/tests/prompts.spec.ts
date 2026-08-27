import { beforeEach, describe, expect, it, vi } from "vitest";
import { NoTtyError, confirmOverwrite, selectMode, textInput } from "../libs/prompts.js";
import { createCrocoCommandRuntime, runWithCrocoCommandRuntime } from "../libs/cliRuntime.js";

const promptMocks = vi.hoisted(() => ({
  cancel: Symbol("cancel"),
  confirm: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
  confirm: promptMocks.confirm,
  isCancel: (value: unknown) => value === promptMocks.cancel,
  select: promptMocks.select,
  text: promptMocks.text,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("NoTtyError", () => {
  it("should have correct message and name", () => {
    const error = new NoTtyError();
    expect(error.name).toBe("NoTtyError");
    expect(error.message).toContain("TTY required");
  });
});

describe("confirmOverwrite", () => {
  beforeEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it("should throw NoTtyError when not in TTY", async () => {
    await expect(confirmOverwrite("/tmp/file.ts")).rejects.toThrow(NoTtyError);
  });

  it("should use the injected TTY capability", async () => {
    setTty(true);

    await expect(
      runWithCrocoCommandRuntime(createCrocoCommandRuntime({ isTTY: false }), () =>
        confirmOverwrite("/tmp/file.ts"),
      ),
    ).rejects.toThrow(NoTtyError);
    expect(promptMocks.confirm).not.toHaveBeenCalled();
  });

  it("should return cancellation without exiting the process", async () => {
    setTty(true);
    promptMocks.confirm.mockResolvedValue(promptMocks.cancel);
    const exit = vi.spyOn(process, "exit");

    await expect(confirmOverwrite("/tmp/file.ts")).resolves.toEqual({ status: "cancelled" });
    expect(exit).not.toHaveBeenCalled();
  });

  it("should return the submitted confirmation", async () => {
    setTty(true);
    promptMocks.confirm.mockResolvedValue(true);

    await expect(confirmOverwrite("/tmp/file.ts")).resolves.toEqual({
      status: "completed",
      value: true,
    });
  });

  it("should preserve ordinary prompt failures as rejections", async () => {
    setTty(true);
    promptMocks.confirm.mockRejectedValue(new Error("prompt failed"));
    const exit = vi.spyOn(process, "exit");

    await expect(confirmOverwrite("/tmp/file.ts")).rejects.toThrow("prompt failed");
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("selectMode", () => {
  beforeEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it("should throw NoTtyError when not in TTY", async () => {
    await expect(selectMode([{ label: "A", value: "a" }])).rejects.toThrow(NoTtyError);
  });

  it("should return cancellation without exiting the process", async () => {
    setTty(true);
    promptMocks.select.mockResolvedValue(promptMocks.cancel);
    const exit = vi.spyOn(process, "exit");

    await expect(selectMode([{ label: "A", value: "a" }])).resolves.toEqual({
      status: "cancelled",
    });
    expect(exit).not.toHaveBeenCalled();
  });

  it("should return the selected value", async () => {
    setTty(true);
    promptMocks.select.mockResolvedValue("a");

    await expect(selectMode([{ label: "A", value: "a" }])).resolves.toEqual({
      status: "completed",
      value: "a",
    });
  });
});

describe("textInput", () => {
  beforeEach(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      writable: true,
      configurable: true,
    });
  });

  it("should throw NoTtyError when not in TTY", async () => {
    await expect(textInput("Enter name")).rejects.toThrow(NoTtyError);
  });

  it("should return cancellation without exiting the process", async () => {
    setTty(true);
    promptMocks.text.mockResolvedValue(promptMocks.cancel);
    const exit = vi.spyOn(process, "exit");

    await expect(textInput("Enter name")).resolves.toEqual({ status: "cancelled" });
    expect(exit).not.toHaveBeenCalled();
  });

  it("should return the submitted text", async () => {
    setTty(true);
    promptMocks.text.mockImplementation(
      async (options: { validate?: (value: string) => string | undefined }) => {
        expect(options.validate?.("")).toBe("required");
        expect(options.validate?.("croco")).toBeUndefined();
        return "croco";
      },
    );

    await expect(
      textInput("Enter name", (value) => (value === "" ? "required" : undefined)),
    ).resolves.toEqual({
      status: "completed",
      value: "croco",
    });
  });
});

function setTty(isTty: boolean): void {
  Object.defineProperty(process.stdout, "isTTY", {
    value: isTty,
    writable: true,
    configurable: true,
  });
}
