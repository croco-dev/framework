import { describe, it, expect, vi, beforeEach } from "vitest";
import { NoTtyError, confirmOverwrite, selectMode, textInput } from "../libs/prompts.js";

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
});
